/**
 * Leaflet default marker icon fix for CRA/webpack.
 *
 * Webpack mangles the asset URLs that Leaflet uses for its default icons,
 * causing broken images. This override re-points them to the correct paths.
 * Import this file once, before any Leaflet components render.
 */
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon   from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconUrl:       markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl:     markerShadow,
});
