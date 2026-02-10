import Parser from 'rss-parser';

const parser = new Parser();

export async function fetchIndeed(keyword: string) {
  try {
    // Try different Indeed RSS formats
    const urls = [
      `https://www.indeed.com/rss?q=${encodeURIComponent(keyword)}`,
      `https://rss.indeed.com/rss?q=${encodeURIComponent(keyword)}&l=`,
    ];

    for (const url of urls) {
      try {
        console.log(`   Trying Indeed URL: ${url}`);
        const feed = await parser.parseURL(url);

        console.log(`   ✅ Success! Found ${feed.items.length} items`);

        return feed.items.map(item => ({
          title: item.title!,
          link: item.link!,
          company: item.creator || item.author || 'Unknown',
          description: item.contentSnippet || item.content || '',
          source: 'Indeed',
        }));
      } catch (err: any) {
        console.log(`   ❌ Failed: ${err.message}`);
        continue;
      }
    }

    // If all URLs fail
    console.log('   ⚠️  All Indeed URLs failed, returning empty array');
    return [];
  } catch (error: any) {
    console.error('   ❌ Indeed fetch error:', error.message);
    return [];
  }
}
