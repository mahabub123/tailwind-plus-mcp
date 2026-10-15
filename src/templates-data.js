const definitions = [
  ['oatmeal-olive-instrument', 'Oatmeal', 'SaaS marketing kit', 'A calm marketing site kit with complete pages, flexible sections, and an olive color palette.', null, ['/', '/about', '/pricing']],
  ['spotlight', 'Spotlight', 'Personal website template', 'A personal website for your work, writing, projects, and the things you care about.', 'spotlight', ['/', '/about', '/projects']],
  ['radiant', 'Radiant', 'SaaS marketing template', 'A complete marketing website with product pages, pricing, a company page, and a blog.', 'radiant', ['/', '/company', '/pricing']],
  ['salient', 'Salient', 'SaaS marketing template', 'A polished product website with features, testimonials, and pricing.', 'salient', ['/']],
  ['studio', 'Studio', 'Agency website template', 'Show your team’s work with case studies, an about page, and a contact experience.', 'studio', ['/', '/about', '/work']],
  ['compass', 'Compass', 'Course template', 'A complete learning experience with lessons, resources, and course navigation.', 'compass', ['/']],
  ['pocket', 'Pocket', 'App marketing template', 'Introduce your app with beautiful product screens and a complete marketing website.', 'pocket', ['/']],
  ['primer', 'Primer', 'Book landing page template', 'A complete home for your book, from chapter previews to testimonials.', 'primer', ['/']],
  ['protocol', 'Protocol', 'API documentation template', 'Thoughtful documentation layouts, navigation, and API reference pages.', 'protocol', ['/']],
  ['syntax', 'Syntax', 'Documentation template', 'A beautifully organized documentation website for your next project.', 'syntax', ['/']],
  ['keynote', 'Keynote', 'Conference website template', 'Everything your event needs, from speakers and schedules to sponsors.', 'keynote', ['/']],
  ['commit', 'Commit', 'Changelog template', 'A complete publishing home for product updates and release notes.', 'commit', ['/']],
  ['transmit', 'Transmit', 'Podcast website template', 'A dedicated website for your show, episodes, and listeners.', 'transmit', ['/']],
  ['catalyst', 'Catalyst', 'Application UI kit demo', 'A complete application demo built with the Catalyst component system.', 'catalyst-demo', ['/', '/orders', '/events']],
];
export const templateDefinitions = definitions.map(([id, name, category, description, demo, pages]) => ({ id, name, category, description, archive: id === 'catalyst' ? 'catalyst-ui-kit.zip' : `${id}.zip`, demo: demo ? `https://${demo}.tailwindui.com` : null, pages }));
export function templateDefinition(id) { return templateDefinitions.find(t => t.id === id); }
export function groupTemplates(assets) {
  return templateDefinitions.map(t => {
    const files = assets.filter(a => a.kind === 'template' && (t.id === 'catalyst' ? a.template?.startsWith('catalyst-demo-') : a.template === t.id));
    return { ...t, files: files.length, variants: [...new Set(files.map(a => a.path.includes('-ts/') || a.path.includes('typescript/') || t.id === 'oatmeal-olive-instrument' ? 'TypeScript' : 'JavaScript'))] };
  }).filter(t => t.files > 0);
}
