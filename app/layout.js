export const metadata = { title: 'Tailwind Plus MCP' };
export default function Layout({ children }) {
  return <html lang="en"><body style={{ fontFamily: 'system-ui', margin: '3rem', maxWidth: '48rem' }}>{children}</body></html>;
}
