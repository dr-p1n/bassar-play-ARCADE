// Redirects every non-canonical host to the arcade's real domain, then hands
// everything else to the static assets. Path and query string (?src=, ?ref=)
// survive the hop. Local dev (localhost) is left alone on purpose.
const CANONICAL = "bassarplay.com";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const stray = url.hostname.endsWith(".workers.dev") || url.hostname === "www." + CANONICAL;
    const insecure = url.protocol === "http:" && url.hostname === CANONICAL;
    if (stray || insecure) {
      url.protocol = "https:";
      url.hostname = CANONICAL;
      url.port = "";
      return Response.redirect(url.toString(), 301);
    }
    return env.ASSETS.fetch(request);
  },
};
