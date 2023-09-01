import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PdfCompressorService } from "./exec-compress.js";
import { logger } from "./logger.js";

// docs https://www.ghostscript.com/blog/optimizing-pdfs.html

const PORT = 3333;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compressPdfController = async (request, response) => {
  let body = '';

  request.on('data', (chunk) => {
    body += chunk.toString();
  });

  request.on('end', async () => {
    const buffer = await readFile(resolve(__dirname, '..', 'example.pdf'))
  
    const pdfCompressorService = new PdfCompressorService(logger)
    const res = await pdfCompressorService.compact(
      {
        pdfBuffer: buffer,
        options: {
          compatibilityLevel: 1.4,
          compressLevel: '300dpi'
        },
        operationLog: { teste: 'pdf' }
      }
    )

    await writeFile(resolve(__dirname, '..', 'final.pdf'), res)

    response.setHeader('Content-Type', 'application/json');
    response.writeHead(200);
    response.end(JSON.stringify({ success: 'true' }, null, 2));
  });
}

const server = async (request, response) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': '*',
  }

  if (request.method === 'OPTIONS') {
    response.writeHead(204, headers);
    response.end();
    return;
  }

  compressPdfController(request, response)
}

createServer(server)
.listen(PORT)
.on('listening', () => logger.info(`server running at ${PORT}`));