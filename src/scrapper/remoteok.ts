import Parser from 'rss-parser';

const parser = new Parser();

export async function fetchRemoteOK(keyword: string) {
  const feed = await parser.parseURL(
    `https://remoteok.io/remote-${keyword}-jobs.rss`,
  );

  return feed.items.map(item => ({
    title: item.title!,
    link: item.link!,
    company: item.creator || 'Unknown',
    description: item.contentSnippet || '',
    source: 'RemoteOK',
  }));
}
