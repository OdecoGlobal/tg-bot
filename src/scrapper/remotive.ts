export async function fetchRemotive(keyword: string) {
  try {
    const url = `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(keyword)}&limit=20`;
    console.log(`   Fetching: ${url}`);

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!data.jobs || !Array.isArray(data.jobs)) {
      console.log(`   No jobs found`);
      return [];
    }

    console.log(`   Found ${data.jobs.length} jobs`);

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
