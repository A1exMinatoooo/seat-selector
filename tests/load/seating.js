import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  scenarios: {
    seat_state: { executor: "constant-vus", vus: 100, duration: "2m" },
  },
  thresholds: { http_req_duration: ["p(95)<1000"], http_req_failed: ["rate<0.01"] },
};

export default function seatStateScenario() {
  const baseUrl = __ENV.BASE_URL;
  const eventCode = __ENV.EVENT_CODE;
  const participantCookie = __ENV.PARTICIPANT_COOKIE;
  const response = http.get(`${baseUrl}/api/events/${eventCode}/seat-state?version=0`, {
    headers: { Cookie: participantCookie },
  });
  check(response, { "seat state succeeds": (result) => result.status === 200 || result.status === 204 });
  sleep(3);
}
