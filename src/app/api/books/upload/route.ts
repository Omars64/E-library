import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { del, get, head } from "@vercel/blob";
import { currentUser } from "@/lib/api";
import { requireDatabase } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  let body: HandleUploadBody;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid upload request" }, { status: 400 }); }
  try {
    const response = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const user = await currentUser(request);
        if (!user) throw new Error("Authentication required");
        const id = String(clientPayload ?? "");
        const result = await requireDatabase().query(
          "SELECT format,blob_path,mime_type,byte_size FROM books WHERE id=$1 AND owner_id=$2 AND status='pending'",
          [id,user.id]);
        const book = result.rows[0];
        if (!book || book.blob_path !== pathname) throw new Error("Book upload is not permitted");
        return {
          allowedContentTypes: [book.mime_type],
          maximumSizeInBytes: Number(book.byte_size),
          addRandomSuffix: false,
          tokenPayload: JSON.stringify({ bookId: id, userId: user.id }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        if (!tokenPayload) throw new Error("Missing upload identity");
        const payload = JSON.parse(tokenPayload) as { bookId: string; userId: string };
        const result = await requireDatabase().query(
          "SELECT format,blob_path,mime_type,byte_size FROM books WHERE id=$1 AND owner_id=$2 AND status='pending'",
          [payload.bookId,payload.userId]);
        const book = result.rows[0];
        if (!book || book.blob_path !== blob.pathname) throw new Error("Unrecognized book upload");
        const metadata = await head(blob.pathname);
        const validMetadata = metadata.size === Number(book.byte_size) && metadata.contentType === book.mime_type;
        const file = await get(blob.pathname, { access: "private" });
        if (!file?.stream) throw new Error("Uploaded book cannot be read");
        const reader = file.stream.getReader();
        const first = await reader.read();
        await reader.cancel();
        const bytes = first.value ?? new Uint8Array();
        const isPdf = book.format === "pdf" && bytes.length >= 5 && new TextDecoder().decode(bytes.slice(0,5)) === "%PDF-";
        const isDocx = book.format === "docx" && bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
        if (!validMetadata || !(isPdf || isDocx)) {
          await del(blob.pathname);
          await requireDatabase().query("UPDATE books SET status='rejected',updated_at=now() WHERE id=$1 AND owner_id=$2", [payload.bookId,payload.userId]);
          return;
        }
        await requireDatabase().query(
          "UPDATE books SET status='ready',updated_at=now() WHERE id=$1 AND owner_id=$2 AND status='pending'",
          [payload.bookId,payload.userId]);
      },
    });
    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ error: "Upload was rejected or could not be completed" }, { status: 400 });
  }
}
