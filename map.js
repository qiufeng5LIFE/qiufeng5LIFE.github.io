const map = L.map('map', { zoomControl: false }).setView([31.2304, 121.4737], 5);
L.control.zoom({ position: 'bottomright' }).addTo(map);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

const MARKER_ICONS = {
  scenic: '<svg class="marker-glyph" viewBox="0 0 24 24" aria-hidden="true"><path d="m3 20 7-12 4 7 2-3 5 8H3Z"/><path d="m8.6 10.4 1.4 2.1 1.2-1.6"/></svg>',
  food: '<svg class="marker-glyph" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v8M4 3v5c0 2 6 2 6 0V3M7 11v10M15 3v18M15 3c4 2 5 7 0 10"/></svg>',
  special: '<svg class="marker-glyph" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.5 5.5 6 .7-4.4 4.1 1.2 5.8-5.3-3-5.3 3 1.2-5.8-4.4-4.1 6-.7L12 3Z"/></svg>',
  cycling: '<svg class="marker-glyph" viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="17" r="4"/><circle cx="18" cy="17" r="4"/><path d="m6 17 4-8h4l4 8M9 11h6M10 9 8 6h3"/></svg>',
  motorcycle: '<svg class="marker-glyph" viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="17" r="3"/><circle cx="19" cy="17" r="3"/><path d="m8 17 3-6h4l4 6M10 11 8 8h4M15 11l2-3h3"/></svg>',
  hiking: '<svg class="marker-glyph" viewBox="0 0 24 24" aria-hidden="true"><circle cx="13" cy="4" r="2"/><path d="m11 8 4 2 2 4M11 8l-3 5 3 3-2 5M11 16l4 5M8 13l-3 2"/></svg>',
};

const PLACE_TYPE_CONFIG = {
  scenic: { color: '#27956a', accentColor: '#d9f4e6', icon: 'scenic', shape: 'circle', label: '风景' },
  food: { color: '#ed8a32', accentColor: '#fff0d5', icon: 'food', shape: 'circle', label: '餐饮美食' },
  special: { color: '#7d4aa8', accentColor: '#eadcf5', icon: 'special', shape: 'star', label: '特殊' },
};

const ROUTE_TYPE_CONFIG = {
  cycling: { color: '#2587c8', icon: 'cycling', label: '自行车' },
  motorcycle: { color: '#d85245', icon: 'motorcycle', label: '摩托车' },
  hiking: { color: '#397b54', icon: 'hiking', label: '徒步' },
};

function createMarkerIcon(type, endpoint, compact = false, routeColor) {
  if (!window.ExtraMarkers) return undefined;
  const routeConfig = ROUTE_TYPE_CONFIG[type];
  const placeConfig = PLACE_TYPE_CONFIG[type] || PLACE_TYPE_CONFIG.special;
  const isEndpoint = Boolean(endpoint);
  const isRoute = Boolean(routeConfig);
  const config = routeConfig || placeConfig;
  const shape = !isEndpoint && !isRoute && placeConfig.shape === 'star'
    ? window.ExtraMarkers.PinStarPanel
    : isEndpoint ? window.ExtraMarkers.TackCirclePanel : window.ExtraMarkers.PinCirclePanel;
  return new window.ExtraMarkers.Icon({
    svg: shape,
    color: endpoint === 'start' && /^#[0-9a-f]{6}$/i.test(routeColor || '') ? routeColor
      : endpoint === 'start' ? '#239b56'
        : endpoint === 'end' ? '#d64545' : config.color,
    accentColor: isEndpoint || isRoute ? '#ffffff' : placeConfig.accentColor,
    contentColor: '#ffffff',
    contentHtml: MARKER_ICONS[config.icon],
    scale: compact ? 0.65 : isEndpoint ? 1.08 : 1,
    shadow: compact ? 'none' : 'drop',
  });
}

function createFinishIcon() {
  return L.divIcon({
    className: 'route-finish-marker',
    html: `<svg viewBox="0 0 38 42" aria-hidden="true">
      <path class="finish-pole-outline" d="M11 34V7" />
      <path class="finish-pole" d="M11 34V7" />
      <path class="finish-flag" d="M12 7h20l-5 6 5 6H12z" />
      <path class="finish-check" d="M12 7h5v6h-5zM22 7h5v6h-5zM17 13h5v6h-5zM27 13h5v6h-5z" />
      <circle class="finish-dot-outline" cx="11" cy="34" r="7" />
      <circle class="finish-dot" cx="11" cy="34" r="5" />
    </svg>`,
    iconSize: [38, 42],
    iconAnchor: [11, 34],
    tooltipAnchor: [7, -25],
    popupAnchor: [7, -27],
  });
}

function escapeHtml(value) {
  const node = document.createElement('div'); node.textContent = String(value ?? ''); return node.innerHTML;
}

function bindRouteDetails(layer, item) {
  const distance = Number(item.distanceKm);
  const distanceLabel = Number.isFinite(distance) && distance > 0 ? ` · ${distance.toFixed(distance >= 100 ? 0 : 1)} km` : '';
  const color = /^#[0-9a-f]{6}$/i.test(item.color || '') ? item.color : '#2587c8';
  layer.bindTooltip(`<span class="route-tooltip-content" style="--route-tooltip-color:${color}">${escapeHtml(item.name || '未命名轨迹')}${distanceLabel}</span>`, {
    className: 'route-tooltip',
    direction: 'top',
    sticky: true,
    opacity: 1,
  });
  layer.bindPopup(`<div class="place-popup"><h3>${escapeHtml(item.name || '未命名轨迹')}</h3>${item.description ? `<p>${escapeHtml(item.description)}</p>` : ''}${item.distanceKm ? `<small>${escapeHtml(item.distanceKm)} 公里 · 累计爬升 ${escapeHtml(item.totalAscentMeters || 0)} 米</small>` : ''}</div>`);
}

function getRouteMidpoint(coordinates) {
  if (!coordinates.length) return null;
  if (coordinates.length === 1) return coordinates[0];
  const distances = [];
  let total = 0;
  for (let index = 1; index < coordinates.length; index += 1) {
    const [previousLongitude, previousLatitude] = coordinates[index - 1];
    const [longitude, latitude] = coordinates[index];
    const segment = map.distance([previousLatitude, previousLongitude], [latitude, longitude]);
    distances.push(segment);
    total += segment;
  }
  const target = total / 2;
  let travelled = 0;
  for (let index = 0; index < distances.length; index += 1) {
    const segment = distances[index];
    if (travelled + segment >= target) {
      const ratio = segment ? (target - travelled) / segment : 0;
      const [startLongitude, startLatitude] = coordinates[index];
      const [endLongitude, endLatitude] = coordinates[index + 1];
      return [
        startLongitude + (endLongitude - startLongitude) * ratio,
        startLatitude + (endLatitude - startLatitude) * ratio,
      ];
    }
    travelled += segment;
  }
  return coordinates.at(-1);
}

function createDistanceMarker(coordinates, item, type) {
  const midpoint = getRouteMidpoint(coordinates);
  const distance = Number(item.distanceKm);
  if (!midpoint || !Number.isFinite(distance) || distance <= 0) return null;
  const config = ROUTE_TYPE_CONFIG[type] || ROUTE_TYPE_CONFIG.cycling;
  const color = /^#[0-9a-f]{6}$/i.test(item.color || '') ? item.color : config.color;
  const name = item.name || '未命名轨迹';
  const label = `${name} · ${distance.toFixed(distance >= 100 ? 0 : 1)} km`;
  const icon = L.divIcon({
    className: 'route-distance-marker',
    html: `<span style="--route-label-color:${color}">${escapeHtml(label)}</span>`,
    iconSize: null,
    iconAnchor: [0, 31],
  });
  const [longitude, latitude] = midpoint;
  return L.marker([latitude, longitude], { icon, interactive: false, keyboard: false });
}

function createDirectionMarker(coordinates, item) {
  if (coordinates.length < 2) return null;
  const middleIndex = Math.max(1, Math.min(coordinates.length - 1, Math.floor(coordinates.length * 0.58)));
  const [previousLongitude, previousLatitude] = coordinates[middleIndex - 1];
  const [longitude, latitude] = coordinates[middleIndex];
  const angle = Math.atan2(latitude - previousLatitude, longitude - previousLongitude) * 180 / Math.PI;
  const color = /^#[0-9a-f]{6}$/i.test(item.color || '') ? item.color : '#2587c8';
  return L.marker([latitude, longitude], {
    interactive: false,
    keyboard: false,
    icon: L.divIcon({
      className: 'route-direction-marker',
      html: `<span style="--route-direction-color:${color};transform:rotate(${-angle}deg)">➜</span>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    }),
  });
}

let routeLayer;
let placeLayer;
let selectedRouteId = null;
const routeRecords = new Map();
let routeStyleMode = typeof L.hotline === 'function' ? 'speed' : 'color';
const hiddenCategories = new Set();

function addToCategoryGroup(parent, type, layer) {
  let group = parent.categoryGroups.get(type);
  if (!group) {
    group = L.featureGroup();
    parent.categoryGroups.set(type, group);
    if (!hiddenCategories.has(type)) group.addTo(parent);
  }
  layer.addTo(group);
}

function setCategoryVisible(type, visible) {
  [placeLayer, routeLayer].forEach((parent) => {
    const group = parent?.categoryGroups?.get(type);
    if (!group) return;
    if (visible) group.addTo(parent);
    else parent.removeLayer(group);
  });
}

function createRouteLayer(routes, styleMode = routeStyleMode) {
  const group = L.featureGroup().addTo(map);
  group.categoryGroups = new Map();
  routeRecords.clear();
  routes.features.forEach((feature) => {
    const item = feature.properties || {};
    const routeId = feature.id || item.id || `${item.name}-${item.traveledAt || ''}`;
    const type = item.type || 'cycling';
    const coordinates = feature.geometry?.coordinates || [];
    const speeds = item.speedKmh || [];
    let layer;
    if (styleMode === 'speed' && typeof L.hotline === 'function' && coordinates.length === speeds.length) {
      const hotlineData = coordinates.map(([longitude, latitude], index) => [latitude, longitude, speeds[index]]);
      const routeColor = /^#[0-9a-f]{6}$/i.test(item.color || '') ? item.color : ROUTE_TYPE_CONFIG[type]?.color || '#2587c8';
      layer = L.hotline(hotlineData, {
        min: item.minSpeedKmh ?? 0,
        max: item.maxSpeedKmh ?? 35,
        weight: 7,
        outlineWidth: 2,
        outlineColor: type === 'cycling' ? routeColor : '#ffffff',
        palette: {
          0: '#2c7bb6',
          0.25: '#00a6ca',
          0.5: '#00ccbc',
          0.7: '#90eb9d',
          0.85: '#f9d057',
          1: '#d7191c',
        },
      });
    } else {
      layer = L.polyline(coordinates.map(([longitude, latitude]) => [latitude, longitude]), {
        color: item.color || '#2563eb', weight: item.weight || 5, opacity: 0.85,
      });
    }
    bindRouteDetails(layer, item);
    addToCategoryGroup(group, type, layer);
    const detailLayers = [];
    const routeColor = /^#[0-9a-f]{6}$/i.test(item.color || '') ? item.color : ROUTE_TYPE_CONFIG[type]?.color || '#2587c8';
    const highlightOutline = L.polyline(coordinates.map(([longitude, latitude]) => [latitude, longitude]), {
      color: type === 'cycling' ? routeColor : '#ffffff',
      weight: (styleMode === 'speed' ? 7 : Number(item.weight || 5)) + (type === 'cycling' ? 5 : 7),
      opacity: type === 'cycling' ? 0.72 : 0.9, interactive: false,
    });
    if (coordinates.length) {
      const distanceMarker = createDistanceMarker(coordinates, item, type);
      if (distanceMarker) detailLayers.push(distanceMarker);
      const directionMarker = createDirectionMarker(coordinates, item);
      if (directionMarker) detailLayers.push(directionMarker);
      const routeConfig = ROUTE_TYPE_CONFIG[item.type] || ROUTE_TYPE_CONFIG.cycling;
      const endpoints = [
        { coordinate: coordinates[0], endpoint: 'start', label: `${item.name} · 起点` },
        { coordinate: coordinates.at(-1), endpoint: 'end', label: `${item.name} · 终点` },
      ];
      endpoints.forEach(({ coordinate, endpoint, label }) => {
        const [longitude, latitude] = coordinate;
        const marker = L.marker([latitude, longitude], {
          icon: endpoint === 'end' ? createFinishIcon() : createMarkerIcon(item.type, endpoint, false, item.color),
          title: label,
        });
        marker.bindTooltip(label);
        marker.bindPopup(`<div class="place-popup"><h3>${escapeHtml(label)}</h3><p>${escapeHtml(routeConfig.label)} · ${escapeHtml(item.distanceKm || 0)} 公里</p></div>`);
        detailLayers.push(marker);
      });
    }
    const baseWeight = styleMode === 'speed' ? 7 : Number(item.weight || 5);
    routeRecords.set(routeId, { id: routeId, type, item, layer, highlightOutline, detailLayers, baseWeight });
    layer.on('click', (event) => {
      L.DomEvent.stopPropagation(event.originalEvent);
      selectRoute(routeId, true);
    });
    layer.on('mouseover', () => {
      if (!selectedRouteId && typeof layer.setStyle === 'function') layer.setStyle({ opacity: 1, weight: baseWeight + 2 });
      layer.bringToFront?.();
    });
    layer.on('mouseout', () => {
      if (!selectedRouteId && typeof layer.setStyle === 'function') layer.setStyle({ opacity: 0.85, weight: baseWeight });
    });
  });
  if (selectedRouteId && routeRecords.has(selectedRouteId)) selectRoute(selectedRouteId, false);
  else selectedRouteId = null;
  return group;
}

function selectRoute(routeId, fit = true) {
  selectedRouteId = routeId;
  routeRecords.forEach((record, id) => {
    const selected = id === routeId;
    const categoryGroup = routeLayer?.categoryGroups?.get(record.type);
    if (categoryGroup) {
      if (selected && !categoryGroup.hasLayer(record.highlightOutline)) record.highlightOutline.addTo(categoryGroup);
      if (!selected && categoryGroup.hasLayer(record.highlightOutline)) categoryGroup.removeLayer(record.highlightOutline);
    }
    record.detailLayers.forEach((detail) => {
      if (!categoryGroup) return;
      if (selected && !categoryGroup.hasLayer(detail)) detail.addTo(categoryGroup);
      if (!selected && categoryGroup.hasLayer(detail)) categoryGroup.removeLayer(detail);
    });
    if (typeof record.layer.setStyle === 'function') {
      record.layer.setStyle({ opacity: selected ? 1 : 0.22, weight: selected ? record.baseWeight + 3 : Math.max(2, record.baseWeight - 1) });
    }
    if (selected) {
      record.layer.bringToFront?.();
      record.detailLayers.forEach((detail) => detail.bringToFront?.());
      record.layer.openTooltip?.();
      if (fit && record.layer.getBounds) map.flyToBounds(record.layer.getBounds(), { padding: [70, 70], maxZoom: 14, duration: 0.65 });
    } else record.layer.closeTooltip?.();
  });
  document.body.classList.toggle('route-selected', Boolean(routeId));
}

function clearRouteSelection() {
  selectedRouteId = null;
  routeRecords.forEach((record) => {
    const categoryGroup = routeLayer?.categoryGroups?.get(record.type);
    if (categoryGroup?.hasLayer(record.highlightOutline)) categoryGroup.removeLayer(record.highlightOutline);
    record.detailLayers.forEach((detail) => categoryGroup?.removeLayer(detail));
    record.layer.setStyle?.({ opacity: 0.85, weight: record.baseWeight });
    record.layer.closeTooltip?.();
  });
  document.body.classList.remove('route-selected');
}

function addRouteStyleControl(routes) {
  const control = L.control({ position: 'bottomleft' });
  control.onAdd = () => {
    const element = L.DomUtil.create('div', 'speed-legend route-style-control');
    element.innerHTML = `<div class="route-style-switch">
      <button type="button" data-mode="speed" ${typeof L.hotline !== 'function' ? 'disabled' : ''}>速度渐变</button>
      <button type="button" data-mode="color">定义颜色</button>
    </div><div class="speed-scale"><strong>速度 km/h</strong><div class="speed-gradient"></div><div class="speed-labels"><span>0</span><span>17</span><span>34+</span></div></div>`;
    L.DomEvent.disableClickPropagation(element);
    L.DomEvent.disableScrollPropagation(element);
    const updateState = () => {
      element.querySelectorAll('[data-mode]').forEach((button) => button.classList.toggle('active', button.dataset.mode === routeStyleMode));
      element.querySelector('.speed-scale').hidden = routeStyleMode !== 'speed';
    };
    element.addEventListener('click', (event) => {
      const button = event.target.closest('[data-mode]');
      if (!button || button.disabled || button.dataset.mode === routeStyleMode) return;
      routeStyleMode = button.dataset.mode;
      if (routeLayer) map.removeLayer(routeLayer);
      selectedRouteId = null;
      routeLayer = createRouteLayer(routes, routeStyleMode);
      document.body.classList.remove('route-selected');
      updateState();
    });
    updateState();
    return element;
  };
  control.addTo(map);
}

function renderCategorySummary(places, routes) {
  const counts = new Map();
  places.forEach((item) => counts.set(item.category || 'special', (counts.get(item.category || 'special') || 0) + 1));
  routes.features.forEach((feature) => {
    const type = feature.properties?.type || 'cycling';
    counts.set(type, (counts.get(type) || 0) + 1);
  });
  const summary = document.querySelector('#summary');
  const fragment = document.createDocumentFragment();
  [...Object.entries(PLACE_TYPE_CONFIG), ...Object.entries(ROUTE_TYPE_CONFIG)].forEach(([type, config]) => {
    const count = counts.get(type) || 0;
    if (!count) return;
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'summary-item';
    item.dataset.category = type;
    item.setAttribute('aria-pressed', 'true');
    item.title = `点击隐藏${config.label}`;
    const iconElement = document.createElement('span');
    iconElement.className = 'summary-icon';
    iconElement.style.backgroundColor = config.color;
    iconElement.innerHTML = MARKER_ICONS[config.icon];
    item.append(iconElement);
    item.append(document.createTextNode(`${config.label} ${count}`));
    item.addEventListener('click', () => {
      const visible = hiddenCategories.has(type);
      if (visible) hiddenCategories.delete(type);
      else hiddenCategories.add(type);
      setCategoryVisible(type, visible);
      item.classList.toggle('is-hidden', !visible);
      item.setAttribute('aria-pressed', String(visible));
      item.title = `点击${visible ? '隐藏' : '显示'}${config.label}`;
    });
    fragment.append(item);
  });
  summary.replaceChildren(fragment);
}

async function loadMapData() {
  const [placesResponse, routesResponse] = await Promise.all([
    fetch('./data/places.json'), fetch('./data/routes.geojson'),
  ]);
  if (!placesResponse.ok || !routesResponse.ok) throw new Error('地图数据暂时无法加载');
  const [places, routes] = await Promise.all([placesResponse.json(), routesResponse.json()]);
  routeLayer = createRouteLayer(routes, routeStyleMode);
  placeLayer = L.featureGroup().addTo(map);
  placeLayer.categoryGroups = new Map();
  places.forEach((item) => {
    const type = item.category || 'special';
    const marker = L.marker([item.latitude, item.longitude], {
      icon: createMarkerIcon(type),
      title: item.name || '未命名地点',
    });
    marker.bindTooltip(escapeHtml(item.name || '未命名地点'), {
      direction: 'top',
      offset: [0, -18],
      opacity: 1,
      className: 'place-tooltip',
    });
    addToCategoryGroup(placeLayer, type, marker);
  });
  const all = L.featureGroup([routeLayer, placeLayer]);
  if (all.getBounds().isValid()) map.fitBounds(all.getBounds(), { padding: [36, 36] });
  addRouteStyleControl(routes);
  renderCategorySummary(places, routes);
}

map.on('click', clearRouteSelection);

loadMapData().catch((error) => { const node = document.querySelector('#error'); node.textContent = error.message; node.hidden = false; });
