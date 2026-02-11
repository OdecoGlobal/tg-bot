import Parser from 'rss-parser';

const parser = new Parser();

export async function fetchIndeed(keyword: string) {
  try {
    const urls = [
      `https://www.indeed.com/rss?q=${encodeURIComponent(keyword)}`,
      `https://rss.indeed.com/rss?q=${encodeURIComponent(keyword)}&l=`,
    ];

    for (const url of urls) {
      try {
        const feed = await parser.parseURL(url);

        return feed.items.map(item => ({
          title: item.title!,
          link: item.link!,
          company: item.creator || item.author || 'Unknown',
          description: item.contentSnippet || item.content || '',
          source: 'Indeed',
        }));
      } catch (err: any) {
        console.error(`   ❌ Failed: ${err.message}`);
        continue;
      }
    }

    return [];
  } catch (error: any) {
    console.error('   ❌ Indeed fetch error:', error.message);
    return [];
  }
}
