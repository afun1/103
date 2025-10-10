import path from 'path';
import fs from 'fs';
import { promises as fsPromises } from 'fs';

const FALLBACK_HTML = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Reset Password Unavailable</title></head><body><h1>Reset password page missing</h1><p>The reset password HTML could not be loaded.</p></body></html>';

function resolveResetPasswordHtmlPath() {
  const candidatePaths = [
    path.join(process.cwd(), 'public', 'reset-password.html'),
    path.join(process.cwd(), '..', 'public', 'reset-password.html'),
    path.join(__dirname, '../../../public/reset-password.html'),
    path.join(__dirname, '../../../../public/reset-password.html')
  ];

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return candidatePaths[0];
}

const RESET_PASSWORD_HTML_PATH = resolveResetPasswordHtmlPath();

export default function ResetPassword() {
  return null;
}

export async function getServerSideProps({ res }) {
  try {
    const html = await fsPromises.readFile(RESET_PASSWORD_HTML_PATH, 'utf8');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.write(html);
    res.end();
  } catch (error) {
    console.error('Failed to load reset password HTML:', error);
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