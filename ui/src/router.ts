import { useEffect, useState } from "react";

export type Route =
  | { kind: "overview"; evalName?: string }
  | { kind: "run"; runId: string; evalName?: string };

function parseHash(hash: string): Route {
  const clean = hash.replace(/^#\/?/, "");
  if (!clean) return { kind: "overview" };
  const parts = clean.split("/");

  if (parts[0] === "eval" && parts[1] && parts[2] === "run" && parts[3]) {
    return {
      kind: "run",
      evalName: decodeURIComponent(parts[1]),
      runId: decodeURIComponent(parts[3]),
    };
  }
  if (parts[0] === "eval" && parts[1]) {
    return { kind: "overview", evalName: decodeURIComponent(parts[1]) };
  }
  if (parts[0] === "run" && parts[1]) {
    return { kind: "run", runId: decodeURIComponent(parts[1]) };
  }
  return { kind: "overview" };
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  useEffect(() => {
    const handler = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);
  return route;
}

export function navigate(route: Route): void {
  if (route.kind === "overview") {
    window.location.hash = route.evalName
      ? `#/eval/${encodeURIComponent(route.evalName)}`
      : "#/";
    return;
  }
  if (route.evalName) {
    window.location.hash = `#/eval/${encodeURIComponent(route.evalName)}/run/${encodeURIComponent(route.runId)}`;
  } else {
    window.location.hash = `#/run/${encodeURIComponent(route.runId)}`;
  }
}
