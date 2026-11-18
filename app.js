/* Orbit360 — standalone frontend-only interactive tour demo. No backend or persistence. */
(() => {
  'use strict';
  const demoScenes = [
    { id: 'arrival', name: 'Desert Arrival', tag: 'THE JOURNEY BEGINS', subtitle: 'Your first step into a new perspective.', description: 'A quiet desert road stretching toward the horizon. The starting point of your immersive tour.', image: 'https://pannellum.org/images/tocopilla.jpg', yaw: 20, pitch: -4, category: 'Arrival point', map: [50,113] },
    { id: 'observatory', name: 'Observatory Plateau', tag: 'DISCOVER THE LANDSCAPE', subtitle: 'An entirely different view awaits.', description: 'Stand among the giant radio telescopes and explore the plateau in every direction.', image: 'https://pannellum.org/images/alma.jpg', yaw: 4, pitch: -2, category: 'Panoramic outlook', map: [169,72] },
    { id: 'summit', name: 'Volcanic Outlook', tag: 'THE FINAL DESTINATION', subtitle: 'Take it all in, in full 360°.', description: 'Look across the dramatic volcanic terrain from this remarkable high-altitude vantage point.', image: 'https://pannellum.org/images/lascar.jpg', yaw: 10, pitch: -5, category: 'Scenic viewpoint', map: [272,34] }
  ];
  const scenes = demoScenes.map(s => ({ ...s }));
  const links = [
    { id: 'link-arrival-observatory', source: 'arrival', target: 'observatory', pitch: -12, yaw: 24, label: 'Continue to observatory' },
    { id: 'link-observatory-arrival', source: 'observatory', target: 'arrival', pitch: -13, yaw: -120, label: 'Back to arrival' },
    { id: 'link-observatory-summit', source: 'observatory', target: 'summit', pitch: -15, yaw: 25, label: 'Explore the summit' },
    { id: 'link-summit-observatory', source: 'summit', target: 'observatory', pitch: -15, yaw: -10, label: 'Return to observatory' }
  ];
  const questions = [
    { title: 'What kind of 360° photos do you have?', body: 'Could you share 3–5 original files and mention the camera or export format (for example, JPG equirectangular panoramas)?' },
    { title: 'What places will the tours cover?', body: 'Properties and rooms, roads and outdoor routes, construction sites, showrooms, or something else?' },
    { title: 'How should visitors move around?', body: 'Click arrows between photo locations, use a GPS map as well, or freely walk through a true 3D model?' },
    { title: 'How many tours and photos do you expect?', body: 'An approximate number of locations per tour and total tours helps us choose the right image storage and loading strategy.' },
    { title: 'Who needs access to manage them?', body: 'One company administrator, multiple team members, or separate client accounts with their own branded projects?' },
    { title: 'Which extra features matter?', body: 'For example: custom branding, floor plans, maps, information hotspots, private tours, website embedding, and a target launch date.' }
  ];
  let viewer = null;
  let currentScene = 'arrival';
  let mode = 'preview';
  let rotating = false;
  let guidedTimer = null;
  let toastTimer = null;
  let allUploads = [];
  const $ = id => document.getElementById(id);
  const short = str => String(str).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  const current = () => scenes.find(s => s.id === currentScene) || scenes[0];
  const index = () => Math.max(0, scenes.findIndex(s => s.id === currentScene));
  const two = n => String(n).padStart(2, '0');
  const refreshIcons = () => { if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons(); };
  const button = (text, id, variant = 'btn-outline') => `<button class="btn ${variant}" id="${id}">${text}</button>`;

  function showToast(message) {
    $('toastText').textContent = message;
    $('toast').classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 3200);
  }
  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(text);
      else { const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); if (!document.execCommand('copy')) throw new Error('Copy denied'); ta.remove(); }
      showToast('Copied to clipboard');
    } catch (e) { showToast('Clipboard unavailable — try a secure HTTPS page'); }
  }
  function sceneHotspots(id) {
    return links.filter(link => link.source === id).map(link => ({
      id: link.id, type: 'scene', sceneId: link.target, pitch: link.pitch, yaw: link.yaw,
      text: link.label, cssClass: 'nav-hotspot', createTooltipFunc: decorateArrow,
      createTooltipArgs: { label: link.label }
    }));
  }
  function decorateArrow(hotSpotDiv, args) {
    const label = args && args.label ? args.label : 'Go to next scene';
    hotSpotDiv.setAttribute('aria-label', label);
    hotSpotDiv.setAttribute('title', label);
    hotSpotDiv.innerHTML = `<div class="hotspot-mark"><div class="hotspot-arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5m-7 7 7-7 7 7"/></svg></div><span class="hotspot-caption"><span>↗</span>${short(label)}</span></div>`;
  }
  function infoHotspot(hotSpotDiv, args) {
    hotSpotDiv.setAttribute('title', 'Learn more about this location');
    hotSpotDiv.setAttribute('aria-label', 'Information: ' + args.name);
    hotSpotDiv.innerHTML = '<button type="button" class="info-hotspot-button" aria-label="Learn about this place">i</button>';
    hotSpotDiv.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      showModal({ icon: 'info', title: args.name, description: args.description, body: '<div class="modal-hint"><strong>Demo interaction:</strong> Information points can contain text, photos, videos or external links in a finished platform.</div>', showCancel: false });
    });
  }
  function sceneInfoHotspots(id) {
    const scene = scenes.find(s => s.id === id);
    if (!scene || id.startsWith('upload-')) return [];
    return [{ id: 'info-' + id, type: 'info', pitch: 3, yaw: -41, cssClass: 'info-hotspot', createTooltipFunc: infoHotspot, createTooltipArgs: { name: scene.name, description: scene.description } }];
  }
  function makeConfig() {
    const mapped = {};
    scenes.forEach(s => mapped[s.id] = {
      type: 'equirectangular', panorama: s.image, pitch: s.pitch, yaw: s.yaw, hfov: 104,
      hotSpots: [...sceneHotspots(s.id), ...sceneInfoHotspots(s.id)]
    });
    return {
      default: { firstScene: currentScene, sceneFadeDuration: 680, autoLoad: true, showControls: false, showFullscreenCtrl: false, showZoomCtrl: false, keyboardZoom: true, compass: false, hfov: 104, minHfov: 45, maxHfov: 120, strings: { loadingLabel: 'Loading 360° image...' } },
      scenes: mapped
    };
  }
  function initViewer() {
    if (typeof window.pannellum === 'undefined') {
      $('viewerLoading').innerHTML = '<strong>Panorama viewer unavailable</strong><small>Check your internet connection and reload. This demo loads its viewer from a CDN.</small>';
      return;
    }
    try {
      viewer = window.pannellum.viewer('panorama', makeConfig());
      viewer.on('load', () => { $('viewerLoading').classList.add('hidden'); syncScene(viewer.getScene() || currentScene); });
      viewer.on('scenechange', sceneId => { $('viewerLoading').classList.remove('hidden'); syncScene(sceneId); });
      viewer.on('error', () => { $('viewerLoading').innerHTML = '<strong>Image could not be loaded</strong><small>Check your internet connection and try a different location.</small>'; $('viewerLoading').classList.remove('hidden'); });
      setTimeout(() => { if (viewer && viewer.isLoaded && viewer.isLoaded()) $('viewerLoading').classList.add('hidden'); }, 1300);
    } catch (error) {
      $('viewerLoading').innerHTML = '<strong>Viewer could not initialize</strong><small>Try reloading in a modern browser with WebGL enabled.</small>';
    }
  }
  function syncScene(sceneId) {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return;
    currentScene = sceneId;
    const idx = index();
    $('viewerSceneLabel').textContent = scene.name;
    $('viewerTitle').textContent = scene.name;
    $('viewerSubtitle').textContent = scene.subtitle;
    $('placeIndex').textContent = `STOP ${two(idx + 1)} — ${scene.tag}`;
    $('viewCounter').innerHTML = `${two(idx + 1)} <small>/ ${two(scenes.length)}</small>`;
    $('waypointCounter').textContent = `${two(idx + 1)} / ${two(scenes.length)}`;
    $('stopCount').textContent = scenes.length;
    $('panorama').style.backgroundImage = `url('${scene.image}')`;
    renderSceneList();
    renderMap();
    if (!scene.id.startsWith('upload-')) {
      try { history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${scene.id}`); } catch (_) {}
    }
  }
  function goTo(id) {
    if (!scenes.some(s => s.id === id)) return;
    if (rotating) stopRotating();
    if (viewer) { try { viewer.loadScene(id); } catch (error) { showToast('Could not load this scene'); } }
    else syncScene(id);
  }
  function travel(delta) { goTo(scenes[(index() + delta + scenes.length) % scenes.length].id); }
  function renderSceneList() {
    const container = $('sceneList');
    container.innerHTML = scenes.map((s, idx) => `<button type="button" class="scene-item ${s.id === currentScene ? 'active' : ''}" data-scene="${short(s.id)}"><span class="scene-number">${two(idx + 1)}</span><img class="scene-image" alt="" src="${short(s.image)}" /><span class="scene-body"><strong>${short(s.name)}</strong><small>${short(s.category)}</small></span><i class="scene-arrow" data-lucide="arrow-up-right"></i></button>`).join('');
    container.querySelectorAll('[data-scene]').forEach(b => b.addEventListener('click', () => { stopGuided(); goTo(b.dataset.scene); }));
    refreshIcons();
  }
  function renderMap() {
    const group = $('mapMarkers');
    while (group.firstChild) group.removeChild(group.firstChild);
    scenes.forEach((scene, idx) => {
      const pos = scene.map || [40 + (idx * 47) % 235, 110 - (idx * 27) % 85];
      const active = currentScene === scene.id;
      const xmlns = 'http://www.w3.org/2000/svg';
      const marker = document.createElementNS(xmlns, 'g');
      marker.setAttribute('class', 'map-pin-dot');
      marker.setAttribute('role', 'button');
      marker.setAttribute('tabindex', '0');
      marker.setAttribute('aria-label', `Go to ${scene.name}`);
      const outer = document.createElementNS(xmlns, 'circle');
      outer.setAttribute('cx', pos[0]); outer.setAttribute('cy', pos[1]); outer.setAttribute('r', active ? 14 : 12); outer.setAttribute('fill', active ? '#2b6753' : '#ffffff'); outer.setAttribute('stroke', active ? '#e2eadb' : '#b9c9b7'); outer.setAttribute('stroke-width', 3);
      const t = document.createElementNS(xmlns, 'text');
      t.setAttribute('x', pos[0]); t.setAttribute('y', pos[1] + 3); t.setAttribute('text-anchor', 'middle'); t.setAttribute('font-size', '9'); t.setAttribute('font-weight', '800'); t.setAttribute('fill', active ? '#ffffff' : '#456754'); t.textContent = idx + 1;
      marker.appendChild(outer); marker.appendChild(t);
      marker.addEventListener('click', () => { stopGuided(); goTo(scene.id); });
      marker.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); stopGuided(); goTo(scene.id); } });
      group.appendChild(marker);
    });
  }
  function stopRotating() {
    if (viewer) { try { viewer.stopAutoRotate(); } catch (_) {} }
    rotating = false;
    $('rotateBtn').classList.remove('toggled');
  }
  function toggleRotating() {
    if (!viewer) return;
    rotating = !rotating;
    rotating ? viewer.startAutoRotate(-2) : viewer.stopAutoRotate();
    $('rotateBtn').classList.toggle('toggled', rotating);
    showToast(rotating ? 'Auto-rotation enabled' : 'Auto-rotation paused');
  }
  function startGuided() {
    stopGuided();
    goTo(scenes[0].id);
    $('guidedLabel').textContent = 'Pause guided tour';
    $('guidedSublabel').textContent = 'Automatically exploring stops';
    $('guidedBtn').querySelector('.guided-circle').innerHTML = '<i data-lucide="pause"></i>';
    guidedTimer = setInterval(() => travel(1), 6500);
    refreshIcons();
    showToast('Guided tour started');
  }
  function stopGuided() {
    clearInterval(guidedTimer); guidedTimer = null;
    $('guidedLabel').textContent = 'Start guided tour';
    $('guidedSublabel').textContent = 'Let the experience unfold';
    $('guidedBtn').querySelector('.guided-circle').innerHTML = '<i data-lucide="play"></i>';
    refreshIcons();
  }
  function showMode(next) {
    if (next !== 'preview' && next !== 'studio' && next !== 'requirements') return;
    mode = next;
    stopGuided();
    if (rotating) stopRotating();
    $('experiencePage').classList.toggle('hidden', next === 'requirements');
    $('requirementsPage').classList.toggle('hidden', next !== 'requirements');
    $('studioEditor').classList.toggle('hidden', next !== 'studio');
    $('featureStrip').classList.toggle('hidden', next === 'studio');
    $('pageTitle').innerHTML = next === 'studio' ? 'Build your own journey<span class="gold-dot">.</span>' : 'See it from every angle<span class="gold-dot">.</span>';
    $('pageLead').textContent = next === 'studio' ? 'Experiment with adding your own panoramas and linking scenes through interactive navigation arrows.' : 'One place, endless perspectives. Explore a real 360° walkthrough and move naturally between connected scenes.';
    $('switchToStudio').innerHTML = next === 'studio' ? '<i data-lucide="eye"></i><span>View tour preview</span>' : '<i data-lucide="wand-sparkles"></i><span>Open tour studio</span>';
    $('breadcrumb').textContent = next === 'requirements' ? 'Project brief' : next === 'studio' ? 'Tour studio' : 'Tour preview';
    document.querySelectorAll('[data-page]').forEach(b => b.classList.toggle('active', b.dataset.page === next));
    $('sidebar').classList.remove('open'); $('mobileScrim').classList.remove('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => { if (viewer && next !== 'requirements') { try { viewer.resize(); } catch (_) {} } }, 130);
    refreshIcons();
  }
  function showModal({ icon = 'route', title, description, body, confirm = 'Confirm', onConfirm = null, showCancel = true }) {
    $('modalIcon').innerHTML = `<i data-lucide="${icon}"></i>`;
    $('modalTitle').textContent = title;
    $('modalDescription').textContent = description;
    $('modalBody').innerHTML = body || '';
    $('modalActions').innerHTML = `${showCancel ? button('Cancel', 'modalCancel') : ''}${onConfirm ? button(confirm, 'modalConfirm', 'btn-primary') : button('Got it', 'modalGotIt', 'btn-primary')}`;
    $('modalBackdrop').classList.remove('hidden');
    $('modalCancel')?.addEventListener('click', closeModal);
    $('modalGotIt')?.addEventListener('click', closeModal);
    $('modalConfirm')?.addEventListener('click', onConfirm);
    refreshIcons();
  }
  function closeModal() { $('modalBackdrop').classList.add('hidden'); }
  function addArrowFlow() {
    if (!viewer || scenes.length < 2) { showToast('Add another scene before creating a link'); return; }
    const options = scenes.filter(s => s.id !== currentScene).map(s => `<option value="${short(s.id)}">${short(s.name)}</option>`).join('');
    showModal({ icon: 'navigation', title: 'Add navigation arrow', description: 'The arrow will appear where your camera is currently pointing.', body: `<label for="arrowTarget">Destination scene</label><select id="arrowTarget">${options}</select><div class="modal-hint">Current scene: <strong>${short(current().name)}</strong><br>Arrow position: camera center (slightly below the horizon). You can look around before opening this dialog.</div>`, confirm: 'Add arrow', onConfirm: () => {
      const targetId = $('arrowTarget').value;
      const dest = scenes.find(s => s.id === targetId);
      if (!dest) return;
      const link = { id: 'link-' + Date.now(), source: currentScene, target: targetId, yaw: viewer.getYaw(), pitch: Math.max(-65, viewer.getPitch() - 13), label: `Go to ${dest.name}` };
      const hotSpot = { id: link.id, pitch: link.pitch, yaw: link.yaw, type: 'scene', sceneId: targetId, text: link.label, cssClass: 'nav-hotspot', createTooltipFunc: decorateArrow, createTooltipArgs: { label: link.label } };
      try { viewer.addHotSpot(hotSpot, currentScene); links.push(link); closeModal(); showToast('Navigation arrow added! Click it to test.'); } catch (e) { showToast('Could not add arrow — try again'); }
    } });
  }
  function uploadPhoto(file) {
    if (!file) return;
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) { showToast('Use JPG, PNG, or WebP panoramas'); return; }
    if (file.size > 40 * 1024 * 1024) { showToast('This demo accepts files up to 40 MB'); return; }
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const ratio = image.naturalWidth / image.naturalHeight;
      if (Math.abs(ratio - 2) > .16) { URL.revokeObjectURL(url); showToast('Please upload a 2:1 equirectangular panorama'); return; }
      const id = 'upload-' + Date.now();
      const name = file.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ').trim().slice(0, 48) || 'New panorama';
      const scene = { id, name, tag: 'YOUR UPLOADED PANORAMA', subtitle: 'Your own 360° image in action.', description: 'Uploaded locally in this browser session.', image: url, yaw: 0, pitch: 0, category: 'Uploaded sample' };
      try { viewer.addScene(id, { type: 'equirectangular', panorama: url, yaw: 0, pitch: 0, hfov: 104, hotSpots: [] }); scenes.push(scene); allUploads.push(url); syncScene(id); goTo(id); showToast('Panorama added! Connect it with arrows.'); }
      catch (e) { URL.revokeObjectURL(url); showToast('Could not open the selected panorama'); }
    };
    image.onerror = () => { URL.revokeObjectURL(url); showToast('Could not read image file'); };
    image.src = url;
  }
  function exportTour() {
    const configuration = {
      title: 'Atacama Explorer — mock tour', generatedAt: new Date().toISOString(),
      notice: 'Frontend-only prototype. blob: image URLs from uploaded files are valid only in the current browser session.',
      scenes: scenes.map(s => ({ id: s.id, title: s.name, panoramaUrl: s.id.startsWith('upload-') ? 'LOCAL_UPLOAD_REPLACE_WITH_HOSTED_URL' : s.image, yaw: s.yaw, pitch: s.pitch })),
      navigationLinks: links.map(({ id, source, target, pitch, yaw, label }) => ({ id, from: source, to: target, pitch, yaw, label }))
    };
    const blob = new Blob([JSON.stringify(configuration, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'orbit360-tour-config.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    showToast('Tour configuration exported as JSON');
  }
  function renderQuestions() {
    $('questionsGrid').innerHTML = questions.map((q, i) => `<article class="question-card"><span class="question-num">${two(i + 1)}</span><h3>${short(q.title)}</h3><p>${short(q.body)}</p></article>`).join('');
  }
  function questionMessage() {
    return `Hi! We've prepared a working 360° virtual-tour sample to illustrate the idea. To scope the full platform accurately, could you please confirm the following?\n\n${questions.map((q, i) => `${i + 1}. ${q.title}\n   ${q.body}`).join('\n\n')}\n\nIf possible, please send 3–5 original 360° images so we can test the actual format. The current demo shows linked panoramas, not free movement through a real 3D model. Thank you!`;
  }
  function bindEvents() {
    document.querySelectorAll('[data-page]').forEach(el => el.addEventListener('click', () => showMode(el.dataset.page)));
    $('switchToStudio').addEventListener('click', () => showMode(mode === 'studio' ? 'preview' : 'studio'));
    $('sidebarBriefBtn').addEventListener('click', () => showMode('requirements'));
    $('backToTour').addEventListener('click', () => showMode('preview'));
    $('menuBtn').addEventListener('click', () => { $('sidebar').classList.add('open'); $('mobileScrim').classList.add('active'); });
    $('mobileScrim').addEventListener('click', () => { $('sidebar').classList.remove('open'); $('mobileScrim').classList.remove('active'); });
    $('prevBtn').addEventListener('click', () => { stopGuided(); travel(-1); });
    $('nextBtn').addEventListener('click', () => { stopGuided(); travel(1); });
    $('zoomInBtn').addEventListener('click', () => { if (viewer) viewer.setHfov(Math.max(45, viewer.getHfov() - 13)); });
    $('zoomOutBtn').addEventListener('click', () => { if (viewer) viewer.setHfov(Math.min(120, viewer.getHfov() + 13)); });
    $('rotateBtn').addEventListener('click', toggleRotating);
    $('resetBtn').addEventListener('click', () => { if (viewer) { viewer.setPitch(current().pitch, 700); viewer.setYaw(current().yaw, 700); viewer.setHfov(104, 700); } });
    $('fullscreenBtn').addEventListener('click', () => { if (viewer) viewer.toggleFullscreen(); });
    $('guidedBtn').addEventListener('click', () => guidedTimer ? stopGuided() : startGuided());
    $('shareBtn').addEventListener('click', () => copyText(window.location.href));
    $('copyQuestionsBtn').addEventListener('click', () => copyText(questionMessage()));
    $('addHotspotBtn').addEventListener('click', addArrowFlow);
    $('uploadBtn').addEventListener('click', () => $('fileInput').click());
    $('fileInput').addEventListener('change', e => { uploadPhoto(e.target.files[0]); e.target.value = ''; });
    $('exportBtn').addEventListener('click', exportTour);
    $('helpBtn').addEventListener('click', () => showModal({ icon: 'scan-eye', title: 'How this demo works', description: 'A functioning 360° virtual-tour viewer, built without a backend or database.', body: '<div class="modal-hint"><strong>Explore:</strong> Drag the image or swipe on mobile. Use your scroll wheel or +/- buttons to zoom.<br><br><strong>Move:</strong> Click floating arrows inside the panorama, the scene list, or markers on the route diagram.<br><br><strong>Create:</strong> In Tour Studio, upload a 2:1 panorama and add a navigation arrow at the current camera direction.<br><br><strong>Limitations:</strong> The map is illustrative, uploaded files and edits are temporary, and this is not a true 3D mesh.</div>', showCancel: false }));
    $('routeInfoBtn').addEventListener('click', () => showModal({ icon: 'map', title: 'About this route', description: 'The right-hand map shows a conceptual path between the sample panorama points.', body: '<div class="modal-hint">All scene links and route markers are <strong>illustrative mock data</strong>. There is no GPS routing, automatic photogrammetry, or real geographical connection. A production tour can support an actual floor plan or geo-referenced map once the client provides that information.</div>', showCancel: false }));
    $('modalClose').addEventListener('click', closeModal);
    $('modalBackdrop').addEventListener('click', e => { if (e.target === $('modalBackdrop')) closeModal(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeModal(); $('sidebar').classList.remove('open'); $('mobileScrim').classList.remove('active'); } });
    window.addEventListener('beforeunload', () => allUploads.forEach(url => URL.revokeObjectURL(url)));
  }
  function bootstrap() {
    const hash = window.location.hash.slice(1);
    if (scenes.some(s => s.id === hash)) currentScene = hash;
    renderSceneList(); renderMap(); renderQuestions(); bindEvents(); refreshIcons();
    syncScene(currentScene);
    initViewer();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootstrap);
  else bootstrap();
})();
