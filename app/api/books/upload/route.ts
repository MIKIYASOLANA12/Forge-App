import { NextRequest, NextResponse } from 'next/server'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { PDFParse } from 'pdf-parse'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const file = formData.get('file')
  const bookId = formData.get('bookId')?.toString()
  if (!(file instanceof File) || !bookId) return NextResponse.json({ error: 'file and bookId are required' }, { status: 400 })
  const buffer = Buffer.from(await file.arrayBuffer())
  let text: string
  if (file.name.toLowerCase().endsWith('.pdf')) {
    const parser = new PDFParse({ data: buffer })
    try {
      text = (await parser.getText()).text
    } finally {
      await parser.destroy()
    }
  } else {
    text = buffer.toString('utf8')
  }
  const safeName = `${bookId}-${Date.now()}.txt`
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'books')
  await mkdir(uploadDir, { recursive: true })
  await writeFile(path.join(uploadDir, safeName), text, 'utf8')
  const chunks = text.split(/\n\s*\n/).map((chunk) => chunk.trim()).filter(Boolean)
  await prisma.book.update({ where: { id: bookId }, data: { sourceFile: `/uploads/books/${safeName}`, chunks: JSON.stringify(chunks) } })
  return NextResponse.json({ success: true, sourceFile: `/uploads/books/${safeName}` })
}