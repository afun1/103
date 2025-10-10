import path from 'path';
import fs from 'fs';
import { promises as fsPromises } from 'fs';

const FALLBACK_HTML = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Sign Up Unavailable</title></head><body><h1>Sign up page missing</h1><p>The sign up HTML could not be loaded.</p></body></html>';

function resolveSignupHtmlPath() {
  const candidatePaths = [
    path.join(process.cwd(), 'public', 'signup.html'),
    path.join(process.cwd(), '..', 'public', 'signup.html'),
    path.join(__dirname, '../../../public/signup.html'),
    path.join(__dirname, '../../../../public/signup.html')
  ];

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return candidatePaths[0];
}

const SIGNUP_HTML_PATH = resolveSignupHtmlPath();

export default function Signup() {
  return null;
}

export async function getServerSideProps({ res }) {
  try {
    const html = await fsPromises.readFile(SIGNUP_HTML_PATH, 'utf8');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.write(html);
    res.end();
  } catch (error) {
    console.error('Failed to load signup HTML:', error);
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