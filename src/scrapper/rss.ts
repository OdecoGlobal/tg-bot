import Parser from "rss-parser";

const parser = new Parser();

type JobItem = {
  title: string;
  company: string;
  link: string;
  source: string;
};

export async function fetchJobsFromRss(feedUrl: string, source: string) {
  const feed = await parser.parseURL(feedUrl);
  return feed.items.map((item) => ({
    title: item.title,
    company: item.creator || "Unknown",
    link: item.link,
    source,
  }));
}
