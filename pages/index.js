export default function Home() {
  return null;
}

export async function getServerSideProps({ res }) {
  if (!res.headersSent) {
    res.writeHead(302, { Location: '/login.html' });
  }
  res.end();
  return { props: {} };
}

export const config = {
  runtime: 'nodejs'
};