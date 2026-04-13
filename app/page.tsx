export default function Home() {
  return (
    <main style={{ fontFamily: "monospace", padding: "2rem" }}>
      <h1>Alpha Vantage CSV-to-JSON API</h1>
      <ul>
        <li><a href="/api/earnings-calendar">/api/earnings-calendar</a></li>
        <li><a href="/api/listing-status">/api/listing-status</a></li>
        <li><a href="/api/ipo-calendar">/api/ipo-calendar</a></li>
        <li><a href="/api/health">/api/health</a></li>
      </ul>
    </main>
  );
}