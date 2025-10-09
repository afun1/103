import path from 'path';
import fs from 'fs';
import { promises as fsPromises } from 'fs';

const FALLBACK_HTML = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Recorder Unavailable</title></head><body><h1>Recorder bundle missing</h1><p>The recorder HTML could not be loaded.</p></body></html>';

function resolveIndexHtmlPath() {
  const candidatePaths = [
    path.join(process.cwd(), 'public', 'index.html'),
    path.join(process.cwd(), '..', 'public', 'index.html'),
    path.join(__dirname, '../../../public/index.html'),
    path.join(__dirname, '../../../../public/index.html')
  ];

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return candidatePaths[0];
}

const INDEX_HTML_PATH = resolveIndexHtmlPath();

export default function Recorder() {
  return null;
}

export async function getServerSideProps({ res }) {
  try {
    const html = await fsPromises.readFile(INDEX_HTML_PATH, 'utf8');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.write(html);
    res.end();
  } catch (error) {
    console.error('Failed to load recorder HTML:', error);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
    }
    res.write(FALLBACK_HTML);
    res.end();
  }

  return { props: {} };
}

export const config = {
  runtime: 'nodejs'
};
