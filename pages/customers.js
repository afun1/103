import path from 'path';
import fs from 'fs';
import { promises as fsPromises } from 'fs';

const FALLBACK_HTML = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Customers Unavailable</title></head><body><h1>Customers page missing</h1><p>The customers HTML could not be loaded.</p></body></html>';

function resolveCustomersHtmlPath() {
  const candidatePaths = [
    path.join(process.cwd(), 'public', 'customers.html'),
    path.join(process.cwd(), '..', 'public', 'customers.html'),
    path.join(__dirname, '../../../public/customers.html'),
    path.join(__dirname, '../../../../public/customers.html')
  ];

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

export async function getServerSideProps() {
  try {
    const htmlPath = resolveCustomersHtmlPath();
    if (!htmlPath) {
      console.warn('⚠️ customers.html not found, using fallback');
      return { props: { htmlContent: FALLBACK_HTML } };
    }

    const htmlContent = await fsPromises.readFile(htmlPath, 'utf8');
    return { props: { htmlContent } };
  } catch (error) {
    console.error('❌ Error loading customers.html:', error);
    return { props: { htmlContent: FALLBACK_HTML } };
  }
}

export default function CustomersPage({ htmlContent }) {
  return <div dangerouslySetInnerHTML={{ __html: htmlContent }} />;
}