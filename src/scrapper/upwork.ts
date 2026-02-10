import Parser from 'rss-parser';

const parser = new Parser();

export async function fetchUpwork(keyword: string) {
  const url = `https://www.upwork.com/ab/feed/jobs/rss?q=${encodeURIComponent(
    keyword,
  )}`;

  const feed = await parser.parseURL(url);

  return feed.items.map(item => ({
    title: item.title!,
    link: item.link!,
    company: 'Upwork Client',
    description: item.contentSnippet || '',
    source: 'Upwork',
  }));
}
