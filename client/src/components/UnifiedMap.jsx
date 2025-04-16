import React, { useEffect, memo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, Circle, Pane } from 'react-leaflet';
import L from 'leaflet';
import MarkerClusterGroup from 'react-leaflet-markercluster';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { InformationCircleIcon, MapPinIcon } from '@heroicons/react/24/outline';


const ZINDEX_USER_LOCATION = 100;
const ZINDEX_RESPONDER = 1500;
const ZINDEX_SELECTED_INCIDENT = 1000;
const ZINDEX_INCIDENT = 500;



const MAX_ACCURACY_CIRCLE_METERS = 2000;


const ChangeView = ({ center, zoom }) => {
    const map = useMap();
    useEffect(() => {
        if (!center || zoom === undefined || zoom === null) return;
        if (typeof center.lat !== 'number' || typeof center.lng !== 'number' || isNaN(center.lat) || isNaN(center.lng)) {
            console.warn("Invalid center provided to ChangeView:", center);
            return;
        }
        try {
            const currentCenter = map.getCenter();
            const targetLatLng = L.latLng(center.lat, center.lng);
            const distance = currentCenter.distanceTo(targetLatLng);
            const FLY_THRESHOLD_METERS = 800;

            if (distance > FLY_THRESHOLD_METERS || map.getZoom() !== zoom) {
                if (map._panAnim || map._zoomAnim) {
                    map.setView(targetLatLng, zoom);
                } else {
                    map.flyTo(targetLatLng, zoom, { duration: 1.0, easeLinearity: 0.5 });
                }
            } else if (map.getZoom() === zoom && (currentCenter.lat !== targetLatLng.lat || currentCenter.lng !== targetLatLng.lng)) {
                map.panTo(targetLatLng, { duration: 0.5 });
            } else if (distance <= (FLY_THRESHOLD_METERS && map.getZoom() !== zoom)) {
                map.setZoom(zoom);
            }
        } catch (error) {
            console.error("Error changing map view:", error);
            try { map.setView(center, zoom); }
            catch (e) { console.error("Fallback setView also failed:", e); }
        }
    }, [center, zoom, map]);
    return null;
};


const createIncidentMarkerIcon = (emoji, severity, isSelected = false) => {
    const displayEmoji = emoji || '📍';
    const effectiveSeverity = severity || 'Low'; // Default to Low

    const baseSize = isSelected ? 38 : 34;
    const innerSize = isSelected ? 30 : 26;
    const emojiSizeClass = isSelected ? 'text-[20px]' : 'text-[17px]';

    let outerBg = 'bg-blue-600'; // Low severity base
    let innerBg = 'bg-blue-100';
    let shadow = 'shadow-md';
    let zIndex = isSelected ? 1000 : 100;
    let ring = '';
    let pulseClass = '';

    if (effectiveSeverity === 'High') {
        outerBg = 'bg-red-600';
        shadow = 'shadow-red-500/50'; pulseClass = 'animate-ping opacity-75';
        if (isSelected) ring = 'ring-2 ring-offset-2 ring-red-500';
    } else if (effectiveSeverity === 'Medium') {
        outerBg = 'bg-yellow-500'; innerBg = 'bg-yellow-100';
        shadow = 'shadow-yellow-500/40';
        if (isSelected) ring = 'ring-2 ring-offset-2 ring-yellow-500';
    } else { // Low severity
        if (isSelected) {
            outerBg = 'bg-indigo-600'; innerBg = 'bg-indigo-100';
            shadow = 'shadow-indigo-500/40';
            ring = 'ring-2 ring-offset-2 ring-indigo-500';
        }
    }

    const pulseHtml = effectiveSeverity === 'High' ? `<div class="absolute inset-0 rounded-full ${outerBg} ${pulseClass}"></div>` : '';
    const iconHtml = `
        <div style="z-index: ${zIndex};" class="relative rounded-full ${shadow} transition-all duration-150 ${ring}">
            ${pulseHtml}
            <div class="absolute inset-0 rounded-full ${outerBg} opacity-80"></div>
             <div class="relative flex items-center justify-center rounded-full border-2 border-white/50" style="width: ${baseSize}px; height: ${baseSize}px;">
                 <div class="flex items-center justify-center rounded-full ${innerBg}" style="width: ${innerSize}px; height: ${innerSize}px;">
                    <span class="${emojiSizeClass}" role="img">${displayEmoji}</span>
                 </div>
             </div>
        </div>`;
    return L.divIcon({
        html: iconHtml, className: 'leaflet-custom-incident-icon',
        iconSize: [baseSize, baseSize], iconAnchor: [baseSize / 2, baseSize / 2],
        popupAnchor: [0, -baseSize / 2 - 5]
    });
};

const createClusterIcon = (cluster) => {
    const count = cluster.getChildCount();
    const markers = cluster.getAllChildMarkers();
    let highestSeverity = 'Low';
    let hasHighSeverity = false;

    try {
        markers.forEach(marker => {
            const markerSeverity = marker.options?.severity; // Access severity from marker options
            if (markerSeverity === 'High') {
                highestSeverity = 'High'; hasHighSeverity = true;
                // throw 'found'; // Optimization if needed
            } else if (markerSeverity === 'Medium' && highestSeverity !== 'High') {
                highestSeverity = 'Medium';
            }
        });
    } catch (e) { if (e !== 'found') console.error("Error determining cluster severity:", e); }

    let sizeClass = 'w-10 h-10'; let textSizeClass = 'text-xs';
    if (count >= 10) { sizeClass = 'w-12 h-12'; textSizeClass = 'text-sm'; }
    if (count >= 100) { sizeClass = 'w-14 h-14'; textSizeClass = 'text-base font-semibold'; }

    let bgColorClass = 'bg-blue-600'; // Low severity cluster
    if (highestSeverity === 'Medium') bgColorClass = 'bg-yellow-500';
    if (highestSeverity === 'High') bgColorClass = 'bg-red-600';

    const pingHtml = hasHighSeverity ? `<span class="absolute inline-flex h-full w-full rounded-full ${bgColorClass} opacity-75 animate-ping"></span>` : '';
    const iconHtml = `
        <div class="relative flex items-center justify-center ${sizeClass} drop-shadow-lg">
            ${pingHtml}
            <span class="relative inline-flex rounded-full ${sizeClass} ${bgColorClass} text-white items-center justify-center border-2 border-white/80">
                <span class="${textSizeClass} font-bold">${count}</span>
            </span>
        </div>`;
    const sizeMatch = sizeClass.match(/w-(\d+)/);
    const pixelSize = sizeMatch ? parseInt(sizeMatch[1]) * 4 : 40;
    return L.divIcon({
        html: iconHtml, className: 'marker-cluster-custom',
        iconSize: L.point(pixelSize, pixelSize), iconAnchor: L.point(pixelSize / 2, pixelSize / 2)
    });
};

const createResponderIcon = (status) => {
    let bgColor = 'bg-gray-500'; let iconSymbol = ' R '; let pulse = false;
    let size = 32; let symbolSize = 'text-sm';

    if (status === 'on_way') {
        bgColor = 'bg-blue-600'; pulse = true;
        iconSymbol = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4"><path fill-rule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clip-rule="evenodd" /></svg>';
    } else if (status === 'on_scene') {
        bgColor = 'bg-green-600';
        iconSymbol = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4"><path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143Z" clip-rule="evenodd" /></svg>';
    } else if (status === 'returning') {
        bgColor = 'bg-orange-500';
        iconSymbol = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4"><path fill-rule="evenodd" d="M15.79 10.75a.75.75 0 010 1.5H5.41l2.78 2.78a.75.75 0 11-1.06 1.06l-4.25-4.25a.75.75 0 010-1.06l4.25-4.25a.75.75 0 111.06 1.06L5.41 9.25H15.79z" clip-rule="evenodd" /></svg>';
    }

    const pulseClass = pulse ? 'animate-pulse' : '';
    const iconHtml = `
        <div class="relative rounded-full shadow-lg border-2 border-white/70 ${bgColor} ${pulseClass}" style="width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center;">
           <div class="text-white ${symbolSize} font-bold flex items-center justify-center">${iconSymbol}</div>
        </div>`;
    return L.divIcon({
        html: iconHtml, className: 'leaflet-responder-icon',
        iconSize: [size, size], iconAnchor: [size / 2, size / 2], popupAnchor: [0, -size / 2 - 5]
    });
}

const createUserLocationIcon = () => {
    const innerDotSize = 20;
    const pingRingBaseSizeClass = 'w-6 h-6';
    const totalIconAreaSize = 28;

    const iconHtml = `
        <div class="relative flex justify-center items-center" style="width: ${totalIconAreaSize}px; height: ${totalIconAreaSize}px;">
            <div class="absolute ${pingRingBaseSizeClass} rounded-full bg-blue-500 opacity-40 animate-ping"></div>
            <div class="relative w-5 h-5 rounded-full bg-blue-600 border-2 border-white shadow-md"></div>
        </div>`;
    return L.divIcon({
        html: iconHtml, className: 'leaflet-user-location-icon',
        iconSize: [totalIconAreaSize, totalIconAreaSize],
        iconAnchor: [totalIconAreaSize / 2, totalIconAreaSize / 2],
        popupAnchor: [0, -innerDotSize / 2 - 2]
    });
};

const UserLocationButton = () => {
    const map = useMap();

    const handleClick = () => {
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    map.flyTo([latitude, longitude], 16, {
                        duration: 1.5,
                        easeLinearity: 0.25
                    });
                },
                (error) => {
                    console.error('Error getting location:', error);
                    // Could add a toast notification here
                }
            );
        }
    };

    return (
        <button
            onClick={handleClick}
            className="absolute bottom-20 sm:bottom-24 right-7 sm:right-8 z-[500] bg-white size-10 rounded-md shadow-md flex items-center justify-center text-blue-600 border border-gray-300 focus:outline-none hover:bg-gray-50 transition-colors"
            aria-label="Find my location"
            title="Find my location"
        >
            <MapPinIcon className='size-5'/>
        </button>
    );
};

const MapLegend = () => {
    const legendItems = [
      { severity: 'High', emoji: '🔥', label: 'High Severity Incident', className: 'text-xl' },
      { severity: 'Medium', emoji: '⚠️', label: 'Medium Severity Incident', className: 'text-xl' },
      { severity: 'Low', emoji: '📌', label: 'Low Severity Incident', className: 'text-xl' },
      { 
        type: 'user_location', 
        label: 'Your Location', 
        className: 'relative w-6 h-6', 
        innerContent: (
          <>
            <span className="absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75 animate-ping"></span>
            <span className="relative inline-flex rounded-full h-6 w-6 bg-blue-500 border-2 border-white"></span>
          </>
        )
      },
      { 
        type: 'cluster_high', 
        label: 'Incident Cluster (High)', 
        className: 'relative inline-flex rounded-full w-8 h-8 bg-red-600 border-2 border-white items-center justify-center shadow-lg', 
        content: '5+'
      },
      { 
        type: 'cluster_medium', 
        label: 'Incident Cluster (Medium)', 
        className: 'relative inline-flex rounded-full w-8 h-8 bg-yellow-500 border-2 border-white items-center justify-center shadow-lg', 
        content: '5+'
      },
      { 
        type: 'cluster_low', 
        label: 'Incident Cluster (Low)', 
        className: 'relative inline-flex rounded-full w-8 h-8 bg-blue-600 border-2 border-white items-center justify-center shadow-lg', 
        content: '5+'
      },
    ];
  
    const renderIcon = (item) => {
      if (item.innerContent) {
        return item.innerContent;
      }
      
      return (
        <div className={item.className}>
          {item.emoji || ''}
          {item.content && <span className="text-xs font-bold text-white">{item.content}</span>}
        </div>
      );
    };
  
    return (
      <div className="absolute left-12 top-14 z-50 bg-white/90 backdrop-blur-sm border border-gray-300 rounded-lg shadow-lg p-3 text-xs max-w-[220px]">
        <div className="font-semibold text-sm border-b border-gray-200 pb-1 mb-2 text-gray-700">Legend</div>
        <div className="space-y-2">
          {legendItems.map((item, index) => (
            <div key={index} className="flex items-center space-x-2">
              <div className="relative flex-shrink-0 w-9 h-9 flex items-center justify-center">
                {renderIcon(item)}
              </div>
              <span className="text-gray-600">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
};



const UnifiedMap = ({
    center,
    zoom,
    incidents = [],
    userLocation,
    responder,
    selectedIncidentId,
    onIncidentClick = () => { },
    style,
    className = '',
}) => {
    const defaultStyle = { height: '100%', width: '100%', minHeight: '400px', position: 'relative', zIndex: 0 };
    const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 640 : false);
    const [showLegend, setShowLegend] = useState(false);

    // Handle window resize
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const handleResize = () => {
            setIsMobile(window.innerWidth < 640);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Base map layer
    const activeBaseLayer = {
        url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>'
    };

    const routePolylineOptions = { color: '#3b82f6', weight: 5, opacity: 0.7, dashArray: '8, 8', lineCap: 'round', lineJoin: 'round' };
    const accuracyCircleOptions = { color: 'rgba(59, 130, 246, 0.4)', fillColor: 'rgba(59, 130, 246, 0.1)', fillOpacity: 0.5, weight: 1, interactive: false };


    return (
        <div className={`relative ${className}`} style={style || defaultStyle}>
            <MapContainer
                center={center ? [center.lat, center.lng] : [40.7128, -74.0060]} // Fallback center
                zoom={zoom ?? 13} // Fallback zoom
                scrollWheelZoom={true}
                touchZoom={true}
                dragging={true}
                style={{ height: '100%', width: '100%' }}
                className="leaflet-container z-0"
                minZoom={3} maxZoom={19}
                attributionControl={!isMobile} // Hide attribution on mobile
                zoomControl={!isMobile} // Hide zoom control on mobile for more space
                tap={true} // Enable tap for mobile
                tapTolerance={15} // Make tap more forgiving on mobile
            >
                {center && <ChangeView center={center} zoom={zoom} />}

                <TileLayer {...activeBaseLayer} maxZoom={19} />

                {/* User Location Marker & Accuracy Circle */}
                {userLocation?.lat && userLocation?.lng && (
                    <>
                        <Marker
                            key="user-location"
                            position={[userLocation.lat, userLocation.lng]}
                            icon={createUserLocationIcon()}
                            zIndexOffset={ZINDEX_USER_LOCATION} // Use Constant
                        >
                            <Popup>
                                <div className="text-xs p-1">
                                    <strong className="text-sm block mb-1">Your Location</strong>
                                    {typeof userLocation.accuracy === 'number' && userLocation.accuracy > 0 &&
                                        `Accuracy: ~${userLocation.accuracy.toFixed(0)}m`
                                    }
                                    {typeof userLocation.accuracy === 'number' && userLocation.accuracy > MAX_ACCURACY_CIRCLE_METERS &&
                                        <p className="text-[10px] text-amber-700 mt-1">(Accuracy area too large to display)</p>
                                    }
                                </div>
                            </Popup>
                        </Marker>

                        {/* Accuracy Circle - Conditionally Render based on threshold */}
                        {typeof userLocation.accuracy === 'number' &&
                            userLocation.accuracy > 0 &&
                            userLocation.accuracy <= MAX_ACCURACY_CIRCLE_METERS && (
                                <Circle
                                    key="user-accuracy"
                                    center={[userLocation.lat, userLocation.lng]}
                                    radius={userLocation.accuracy}
                                    pathOptions={accuracyCircleOptions}
                                />
                            )}
                    </>
                )}

                {/* Incident Markers with Clustering */}
                <MarkerClusterGroup
                    key={`mcg-${incidents.length}`}
                    spiderfyOnMaxZoom={true}
                    showCoverageOnHover={false}
                    zoomToBoundsOnClick={true}
                    animate={true}
                    iconCreateFunction={createClusterIcon}
                    maxClusterRadius={isMobile ? 45 : 60} // Smaller clusters on mobile
                    disableClusteringAtZoom={isMobile ? 16 : 17} // Disable clustering at lower zoom on mobile
                    chunkedLoading
                >
                    {incidents.map((incident) => {
                        if (!incident?.location?.lat || !incident?.location?.lng || !incident?.id) {
                            console.warn("Skipping incident marker with invalid data:", incident);
                            return null;
                        }
                        const isSelected = selectedIncidentId === incident.id;
                        const icon = createIncidentMarkerIcon(
                            incident.crime?.emoji,
                            incident.severity,
                            isSelected
                        );

                        return (
                            <Marker
                                key={`incident-${incident.id}`}
                                position={[incident.location.lat, incident.location.lng]}
                                icon={icon}
                                severity={incident.severity || 'Low'}
                                zIndexOffset={isSelected ? ZINDEX_SELECTED_INCIDENT : ZINDEX_INCIDENT}
                                eventHandlers={{ click: () => onIncidentClick(incident) }}
                            >
                                <Popup minWidth={isMobile ? 160 : 180} maxWidth={isMobile ? 220 : 300} autoPanPadding={isMobile ? L.point(30, 30) : L.point(50, 50)}>
                                    <div className="text-xs font-sans p-1 space-y-0.5">
                                        <strong className="text-sm block mb-0.5">
                                            {incident.crime?.label || 'Incident'} {incident.crime?.emoji || ''}
                                        </strong>
                                        {incident.id && <span className="block text-gray-600">ID: {String(incident.id).substring(0, 8)}</span>}
                                        {incident.status && <span className="block text-gray-600">Status: {incident.status}</span>}
                                        {incident.severity && <span className="block text-gray-600 capitalize">Severity: {incident.severity}</span>}
                                        {incident.description && <p className="text-gray-700 my-1 text-[11px] line-clamp-3">{incident.description}</p>}
                                        {incident.timestamp && (
                                            <span className="block text-gray-500 text-[10px] mt-1">
                                                Reported: {new Date(incident.timestamp).toLocaleString()}
                                            </span>
                                        )}
                                    </div>
                                </Popup>
                            </Marker>
                        );
                    })}
                </MarkerClusterGroup>

                {/* Responder Marker */}
                {responder?.location && (responder.status === 'on_way' || responder.status === 'on_scene' || responder.status === 'returning') && responder.location.lat && responder.location.lng && (
                    <Marker
                        key="responder-location"
                        position={[responder.location.lat, responder.location.lng]}
                        icon={createResponderIcon(responder.status)}
                        zIndexOffset={ZINDEX_RESPONDER}
                    >
                        <Popup>
                            <div className="text-xs font-sans p-1">
                                <strong className="text-sm block mb-1">Responding Unit</strong>
                                Status: <span className='font-semibold capitalize'>{responder.status?.replace('_', ' ')}</span>
                            </div>
                        </Popup>
                    </Marker>
                )}

                {/* Responder Route Polyline */}
                {responder?.route && responder.status === 'on_way' && Array.isArray(responder.route) && responder.route.length > 1 && (
                    <Polyline
                        key="responder-route"
                        positions={responder.route.map(p => [p.lat, p.lng])}
                        pathOptions={routePolylineOptions}
                    />
                )}

                {/* User location finding button */}
                 <UserLocationButton />

            </MapContainer>

            {/* Legend Toggle Button */} 
            <button
                onClick={() => setShowLegend(prev => !prev)}
                className="absolute top-2 left-12 z-[1000] bg-white border-2 border-[#c0c3c6] rounded-md shadow-lg p-2 hover:bg-gray-100 flex items-center space-x-1 text-gray-700 hover:text-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
                title={showLegend ? "Hide Legend" : "Show Legend"} aria-label="Toggle map legend" aria-expanded={showLegend}
            >
                 <InformationCircleIcon className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
            

            Conditionally render the Legend (Commented Out)
            {showLegend && <MapLegend />}

        </div>
    );
};

export default memo(UnifiedMap);