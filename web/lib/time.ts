// All business logic runs on Arizona wall-clock time, regardless of where
// the server is hosted (cloud servers run UTC). Arizona never observes DST,
// but using the IANA zone keeps this correct by definition.
//
// The returned Date's LOCAL components equal Phoenix wall time, so all
// existing getHours()/getDate() logic works unchanged on any server.
export function phoenixNow(): Date {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Phoenix" })
  );
}
