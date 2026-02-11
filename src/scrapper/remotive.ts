export async function fetchRemotive(keyword: string) {
  try {
    const url = `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(keyword)}&limit=20`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!data.jobs || !Array.isArray(data.jobs)) {
      return [];
    }

    return data.jobs.map((job: any) => ({
      title: job.title,
      link: job.url,
      company: job.company_name,
      description: (job.description || '').substring(0, 500),
      source: 'Remotive',
    }));
  } catch (error: any) {
    console.error(`   ❌ Remotive error:`, error.message);
    return [];
  }
}
