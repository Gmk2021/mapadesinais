exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=120",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  const q = (event.queryStringParameters && event.queryStringParameters.q) || "Brasil";
  const rss =
    "https://news.google.com/rss/search?q=" +
    encodeURIComponent(q) +
    "&hl=pt-BR&gl=BR&ceid=BR:pt-419";

  try {
    const resp = await fetch(rss, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
    });
    if (!resp.ok) {
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({ status: "error", message: "Google Notícias sem resposta", items: [] }),
      };
    }
    const xml = await resp.text();
    const items = parseRss(xml);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ status: "ok", query: q, items }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ status: "error", message: String(e.message || e), items: [] }),
    };
  }
};

function decode(s) {
  return String(s || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/'/g, "'");
}

function strip(s) {
  return decode(s).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function parseRss(xml) {
  const items = [];
  const blocks = xml.split(/<item>/i).slice(1);
  for (const block of blocks) {
    const title = strip((block.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || "");
    let link = (block.match(/<link>([\s\S]*?)<\/link>/i) || [])[1] || "";
    link = decode(link).trim();
    if (!link) {
      const guid = (block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i) || [])[1] || "";
      if (guid.startsWith("http")) link = decode(guid).trim();
    }
    const desc = strip((block.match(/<description>([\s\S]*?)<\/description>/i) || [])[1] || "");
    const pub = strip((block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i) || [])[1] || "");
    const source = strip((block.match(/<source[^>]*>([\s\S]*?)<\/source>/i) || [])[1] || "");
    if (title && link) {
      items.push({
        title: title.slice(0, 220),
        link,
        description: desc.slice(0, 280),
        pubDate: pub,
        source: source || hostOf(link),
      });
    }
    if (items.length >= 30) break;
  }
  return items;
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "fonte";
  }
}
