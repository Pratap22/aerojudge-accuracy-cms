import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { cn } from '../lib/utils';

export interface EventMapPin {
  label: string;
  latitude: number;
  longitude: number;
  /** CSS colour for the pin. */
  color?: string;
}

function pinIcon(color: string) {
  return L.divIcon({
    className: '',
    iconSize: [22, 22],
    iconAnchor: [11, 22],
    popupAnchor: [0, -20],
    html: `<span style="display:block;width:16px;height:16px;margin-left:3px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4)"></span>`,
  });
}

export function EventMap({
  pins,
  zoom = 13,
  className,
}: {
  pins: EventMapPin[];
  zoom?: number;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const pinsRef = useRef(pins);
  pinsRef.current = pins;
  const pinsKey = pins
    .map((pin) => `${pin.label}:${pin.latitude}:${pin.longitude}:${pin.color ?? ''}`)
    .join('|');

  useEffect(() => {
    const host = hostRef.current;
    const currentPins = pinsRef.current;
    if (!host || currentPins.length === 0) return;

    const map = L.map(host, { scrollWheelZoom: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    const markers = currentPins.map((pin) => {
      const marker = L.marker([pin.latitude, pin.longitude], {
        icon: pinIcon(pin.color ?? '#2563eb'),
      });
      marker.bindPopup(pin.label);
      marker.addTo(map);
      return marker;
    });

    if (markers.length === 1) {
      map.setView(markers[0].getLatLng(), zoom);
      markers[0].openPopup();
    } else {
      const bounds = L.latLngBounds(markers.map((marker) => marker.getLatLng()));
      map.fitBounds(bounds, { padding: [36, 36], maxZoom: zoom });
    }

    const observer = new ResizeObserver(() => {
      map.invalidateSize();
    });
    observer.observe(host);

    return () => {
      observer.disconnect();
      map.remove();
    };
  }, [pinsKey, zoom]);

  return <div ref={hostRef} className={cn('z-0 h-72 w-full sm:h-96', className)} />;
}
