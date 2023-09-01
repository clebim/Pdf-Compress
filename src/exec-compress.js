import { exec as execCb, spawn } from 'node:child_process';
import { promisify } from 'node:util';

export class PdfCompressorService {
  logger;

  constructor(logger) {
    this.logger = logger
  }

  compactLevelMap = new Map([
    ['72dpi', '/screen'],
    ['150dpi', '/ebook'],
    ['300dpi', '/printer'],
    ['default', '/default'],
  ]);

  getBufferSizeInMb(buffer) {
    return Number((buffer.byteLength / (1024 * 1024)).toFixed(2));
  }

  async compact(args) {
    const exec = promisify(execCb);
    const { operationLog, pdfBuffer, options } = args;
    const compatibility = options?.compatibilityLevel ?? 1.4;
    const compressLevel = this.compactLevelMap.has(options?.compressLevel)
    ? this.compactLevelMap.get(options.compressLevel)
    : this.compactLevelMap.get('150dpi');

    try {
      this.logger.info({
        ...operationLog,
        level: 'info',
        message: 'Buscando se aplicação possui Ghostscript instalado',
      });

      const { stdout } = await exec('gs --version');

      this.logger.info({
        ...operationLog,
        level: 'info',
        message: `Ghostscript instalado na versão ${stdout}`,
      });
    } catch (error) {
      this.logger.info({
        ...operationLog,
        level: 'error',
        message: 'Aplicação não possui o ghostscript instalado, retornando buffer enviado',
      });

      return pdfBuffer;
    }

    try {
      this.logger.info({
        ...operationLog,
        level: 'info',
        message: `Realizando compressão do documento.`,
      });

      const compressedPdf = await new Promise((resolve, reject) => {
        const process = spawn('gs', [
          '-q',
          '-sDEVICE=pdfwrite',
          `-dCompatibilityLevel=${compatibility}`,
          '-dEmbedAllFonts=true',
          '-dSubsetFonts=true',
          '-dPrinted=false',
          `-dPDFSETTINGS=${compressLevel}`,
          '-dNOPAUSE',
          '-dQUIET',
          '-dBATCH',
          '-sOutputFile=-',
          '-',
        ]);

        const chunks = [];

        process.stdin.write(pdfBuffer);
        process.stdin.end();

        process.stdout.on('data', (data) => {
          chunks.push(data);
        });

        process.stderr.on('data', (data) => {
          this.logger.error({
            ...operationLog,
            level: 'error',
            message: `Erro ao compactar PDF - ${data}`,
          });
          reject(data);
        });

        process.on('close', (code) => {
          if (code === 0) {
            const compactedPdfBuffer = Buffer.concat(chunks);

            this.logger.info({
              ...operationLog,
              level: 'info',
              message: `Pdf compactado de ${this.getBufferSizeInMb(pdfBuffer)} para ${this.getBufferSizeInMb(
                compactedPdfBuffer,
              )} em MegaBytes.`,
            });

            if (compactedPdfBuffer.byteLength >= pdfBuffer.byteLength) {
              this.logger.info({
                ...operationLog,
                level: 'info',
                message:
                  'Pdf compactado é maior que o original (https://www.ghostscript.com/blog/optimizing-pdfs.html). Retornando buffer original.',
              });
              resolve(pdfBuffer);
            } else {
              this.logger.info({
                ...operationLog,
                level: 'info',
                message: 'Pdf compactado com sucesso. Retornando buffer compactado',
              });
              resolve(compactedPdfBuffer);
            }
          } else {
            this.logger.error({
              ...operationLog,
              level: 'error',
              message: `Erro ao compactar PDF - codigo do erro no SO ${code}`,
            });
            reject(code);
          }
        });
      });

      return compressedPdf;
    } catch (error) {
      this.logger.info({
        ...operationLog,
        level: 'error',
        message: `Erro ao compactar PDF, retornando buffe original. - ${error?.message}`,
      });
      throw error;
    }
  }
}
