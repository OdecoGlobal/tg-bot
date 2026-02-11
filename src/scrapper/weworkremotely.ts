import Parser from 'rss-parser';

const parser = new Parser();

export async function fetchWeWorkRemotely(keyword: string) {
  try {
    const url = `https://weworkremotely.com/remote-jobs.rss`;

    const feed = await parser.parseURL(url);

    const filtered = feed.items.filter(
      item =>
        item.title?.toLowerCase().includes(keyword.toLowerCase()) ||
        item.contentSnippet?.toLowerCase().includes(keyword.toLowerCase()) ||
        item.categories?.some(cat =>
          cat.toLowerCase().includes(keyword.toLowerCase()),
        ),
    );

    return filtered.map(item => ({
      title: item.title!,
      link: item.link!,
      company: item.creator || item.author || 'Remote Company',
      description: item.contentSnippet || '',
      source: 'WeWorkRemotely',
    }));
  } catch (error: any) {
    console.error(`   ❌ WeWorkRemotely error:`, error.message);
    return [];
  }
}
