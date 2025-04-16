import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import UnifiedMap from './UnifiedMap';
import {
    MagnifyingGlassIcon,
    InboxIcon,
    ClockIcon,
    XMarkIcon,
    ArrowPathIcon,
    ExclamationTriangleIcon,
    UserGroupIcon,
    IdentificationIcon,
    ClockIcon as SolidClockIcon
} from '@heroicons/react/20/solid';
import { MapPinIcon as OutlineMapPinIcon, PlayCircleIcon, SpeakerWaveIcon } from '@heroicons/react/24/outline';
import {
    useGetIncidentsQuery,
} from '../api/reportApi';
import { formatTimeAgo, getSeverityDotClasses, getStatusStyle, getSafe } from '../utils/helper';
import { Title } from '../utils';
import { useGeolocated } from 'react-geolocated';
import { toast } from 'sonner';

// Default Map Location
const DEFAULT_LOCATION = { lat: 21.21728, lng: 72.7810048 };
const DEFAULT_ZOOM = 12;

// Combined Status Map for Incidents and Teams
const statusMap = {
    New: "New",
    Acknowledged: "Acknowledged",
    Responding: "Responding",
    Resolved: "Resolved",
    Declined: "Declined",
    assigned: "Assigned", // Can be incident or team status
    // Add other statuses if they appear in data and need specific labels
    available: "Available",
    in_progress: "In Progress",
    pending: "Pending",
    on_way: "On Way",
    on_scene: "On Scene",
    returning: "Returning",
    idle: "Idle"
};

// Utility to get a display label for a status key
function getStatusLabel(key) {
    if (!key) return 'Unknown';
    const label = statusMap[key];
    if (label) return label;
    // Fallback formatting
    return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function cleanIncidentText(text) {
    return text
        .replace(/\n{2,}/g, '\n')         // Replace 2+ newlines with a single one
        .replace(/[ \t]+\n/g, '\n')       // Remove spaces/tabs before a newline
        .replace(/\n[ \t]+/g, '\n')       // Remove spaces/tabs after a newline
        .trim();                          // Trim leading/trailing spaces
}

function AuthorityDashboard() {
    const [selectedReport, setSelectedReport] = useState(null);
    const [userLocation, setUserLocation] = useState(null);
    const [mapCenter, setMapCenter] = useState(DEFAULT_LOCATION);
    const [mapZoom, setMapZoom] = useState(DEFAULT_ZOOM);
    const [searchTerm, setSearchTerm] = useState('');
    const [showSidebarMobile, setShowSidebarMobile] = useState(false);


    const audioRef = useRef(null);

     const { coords, isGeolocationAvailable, isGeolocationEnabled } = useGeolocated({
            positionOptions: { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
            watchPosition: false,
            userDecisionTimeout: 5000,
        });

    const {
        data: incidentsData = [],
        isLoading: isLoadingIncidents,
        isFetching: isFetchingIncidents,
        isError: isErrorIncidents,
        refetch: refetchIncidents,
    } = useGetIncidentsQuery(undefined, { pollingInterval: 10000 });

    useEffect(() => {
        if (coords?.latitude && coords?.longitude) {
            const newLocation = {
                lat: coords.latitude,
                lng: coords.longitude,
                accuracy: 1500,
            };
            setUserLocation(newLocation);
            setMapCenter(newLocation);
            setMapZoom(16);
            toast.success("Live User location found");
        } else if (!isGeolocationAvailable || !isGeolocationEnabled) {
            setUserLocation(null);
            setMapCenter(DEFAULT_LOCATION);
            setMapZoom(DEFAULT_ZOOM);
        }
    }, [coords, isGeolocationAvailable, isGeolocationEnabled]);



    const filteredReports = useMemo(() => {
        const lowerSearchTerm = searchTerm.toLowerCase();

        const reportsToFilter = Array.isArray(incidentsData) ? incidentsData : [];

        const filtered = reportsToFilter.filter(report => {

            if (!report || !report.id) return false;


            const matchesSearch = !searchTerm || (
                getSafe(() => report.crime?.label?.toLowerCase(), '').includes(lowerSearchTerm) ||
                String(report.id)?.toLowerCase().includes(lowerSearchTerm) ||
                getSafe(() => getStatusLabel(report.status)?.toLowerCase(), '').includes(lowerSearchTerm) ||
                getSafe(() => report.severity?.toLowerCase(), '').includes(lowerSearchTerm) ||
                getSafe(() => report.description?.toLowerCase(), '').includes(lowerSearchTerm) ||
                getSafe(() => report.location?.address?.toLowerCase(), '').includes(lowerSearchTerm) ||
                getSafe(() => report.assignedTeam?.name?.toLowerCase(), '').includes(lowerSearchTerm)
            );
            return matchesSearch;
        });

        // Sort reports: New first, then High Severity, then by newest timestamp
        filtered.sort((a, b) => {
            const aStatus = getSafe(() => a.status, '');
            const bStatus = getSafe(() => b.status, '');
            const aSeverity = getSafe(() => a.severity, '');
            const bSeverity = getSafe(() => b.severity, '');
            const timeA = getSafe(() => new Date(a.timestamp).valueOf(), 0);
            const timeB = getSafe(() => new Date(b.timestamp).valueOf(), 0);

            // Prioritize 'New' status
            if (aStatus === 'New' && bStatus !== 'New') return -1;
            if (aStatus !== 'New' && bStatus === 'New') return 1;

            // Prioritize High Severity for non-new items
            const severityOrder = { 'High': 1, 'Medium': 2, 'Low': 3 };
            const severityDiff = (severityOrder[aSeverity] || 99) - (severityOrder[bSeverity] || 99);
            if (severityDiff !== 0) return severityDiff;

            // Finally, sort by newest timestamp
            return timeB - timeA;
        });

        return filtered;
    }, [incidentsData, searchTerm]);



    const totalReportsCount = Array.isArray(incidentsData) ? incidentsData.length : 0;

    const highSeverityCount = useMemo(() =>
        (Array.isArray(incidentsData) ? incidentsData : []).filter(r => r.severity === 'High' && r.status !== 'Resolved' && r.status !== 'Declined').length,
        [incidentsData]
    );


    const handleReportSelect = useCallback((report) => {
        setSelectedReport(report);

        if (report?.location?.lat && report?.location?.lng) {
            setMapCenter({ lat: report.location.lat, lng: report.location.lng });
            setMapZoom(16);
        } else {
            setMapCenter(DEFAULT_LOCATION);
            setMapZoom(DEFAULT_ZOOM);
        }
    }, []);


    const handleMarkerClick = useCallback((incidentData) => {
        if (incidentData && incidentData.id) {
            handleReportSelect(incidentData);

            try {
                const listItem = document.getElementById(`report-item-${incidentData.id}`);
                listItem?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } catch (e) { console.error("Error scrolling list item:", e); }
        }
    }, [handleReportSelect]);


    const closeDetailsPanel = () => {
        setSelectedReport(null);
    };

    const selectedReportStatusStyle = selectedReport ? getStatusStyle(selectedReport.status) : null;
    const isLoading = isLoadingIncidents || isFetchingIncidents;


    return (
        <div className="flex h-full w-full bg-gray-100 overflow-hidden">
            <Title title="Authority Dashboard" />

            {/* Mobile Sidebar Toggle Button - Enhanced styling */}
            <button
                onClick={() => setShowSidebarMobile(!showSidebarMobile)}
                className="fixed bottom-4 left-4 z-50 md:hidden bg-white rounded-full p-3 shadow-lg elevation-2 border border-gray-200 transition-transform active:scale-95"
                aria-label={showSidebarMobile ? "Hide reports" : "Show reports"}
            >
                {showSidebarMobile ? (
                    <XMarkIcon className="h-5 w-5 text-gray-700" />
                ) : (
                    <InboxIcon className="h-5 w-5 text-indigo-600" />
                )}
            </button>

            {/* Main Content Area (Map) */}
            <main className="flex-1 relative h-full">
                <UnifiedMap
                    center={mapCenter}
                    zoom={mapZoom}
                    incidents={filteredReports}
                    userLocation={userLocation}
                    onIncidentClick={handleMarkerClick}
                    selectedIncidentId={selectedReport?.id}
                    className="absolute inset-0 h-full w-full"
                />

                {/* Selected Report Detail Panel - Enhanced styling */}
                {selectedReport && (
                    <div key={selectedReport.id} className="absolute bottom-0 inset-x-0 z-[1010] md:top-2 md:bottom-auto md:left-auto md:right-2 md:w-full md:max-w-xs lg:max-w-md">
                        <div className="flex flex-col max-h-[70vh] md:max-h-[calc(100vh-4rem)] bg-white shadow-xl md:shadow-2xl rounded-t-lg md:rounded-lg overflow-hidden border border-gray-200/80 elevation-3">
                            {/* Panel Header with gradient */}
                            <div className="px-3 py-2.5 sm:px-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200 flex-shrink-0">
                                <div className="flex items-start justify-between gap-x-3">
                                    <div className="flex items-start gap-x-2.5 min-w-0">
                                        <span className="text-2xl sm:text-3xl flex-shrink-0 mt-0.5">{getSafe(() => selectedReport.crime?.emoji, '❓')}</span>
                                        <div className="min-w-0">
                                            <h2 className="text-sm sm:text-base font-semibold text-gray-900 truncate">{getSafe(() => selectedReport.crime?.label, 'Incident')}</h2>
                                            <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5">Report #{String(selectedReport.id).substring(0, 8)}</p>
                                            <span className={`relative mt-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] sm:text-xs font-medium ${selectedReport.severity === 'High' ? 'bg-red-100 text-red-800' :
                                                selectedReport.severity === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                                                    'bg-blue-100 text-blue-800'
                                                }`}>
                                                {selectedReport.severity || 'Unknown'} Severity
                                                {selectedReport.severity === 'High' && selectedReport.status !== 'Resolved' && selectedReport.status !== 'Declined' && (
                                                    <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                                                    </span>
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                    <button type="button" onClick={closeDetailsPanel} className="ml-2 flex-shrink-0 rounded-md text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 p-1 transition-colors">
                                        <XMarkIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                                    </button>
                                </div>
                            </div>

                            {/* Status Section with enhanced styling */}
                            <div className={`px-3 py-2 sm:px-4 border-b border-gray-200 flex-shrink-0 ${selectedReportStatusStyle?.bgColor || 'bg-gray-50'}`}>
                                <div className="flex items-center justify-between gap-x-2">
                                    <div className="flex items-center gap-x-1.5">
                                        {/* Display status icon and text */}
                                        {selectedReportStatusStyle?.icon && React.createElement(selectedReportStatusStyle.icon, { className: `h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 ${selectedReportStatusStyle.textColor}` })}
                                        <span className={`text-xs sm:text-sm font-medium ${selectedReportStatusStyle?.textColor || 'text-gray-800'}`}>{getStatusLabel(selectedReport.status) || 'Unknown'}</span>
                                    </div>
                                    <time dateTime={selectedReport.timestamp} className="text-[10px] sm:text-xs text-gray-500 flex-shrink-0">
                                        Reported {formatTimeAgo(selectedReport.timestamp)}
                                    </time>
                                </div>
                                {/* Display decline reason if applicable */}
                                {selectedReport.status === 'Declined' && selectedReport.declineReason && (
                                    <p className="mt-1 text-[10px] sm:text-xs text-orange-700 italic pl-6">{selectedReport.declineReason}</p>
                                )}
                            </div>

                            {/* Panel Content with enhanced styling */}
                            <div className="flex-1 overflow-y-auto py-1 bg-white overscroll-contain">
                                <dl className="divide-y divide-gray-100 text-xs sm:text-sm">
                                    {/* Assigned Team Details */}
                                    {selectedReport.assignedTeam && (
                                        <>
                                            <div className="px-3 py-2 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-4">
                                                <dt className="text-[10px] sm:text-xs font-medium leading-5 text-gray-500 uppercase tracking-wider flex items-center gap-1">
                                                    <IdentificationIcon className="h-3.5 w-3.5 text-gray-400" /> Team
                                                </dt>
                                                <dd className="mt-1 leading-5 text-gray-800 sm:col-span-2 sm:mt-0">
                                                    <span className="font-medium text-blue-700">{getSafe(() => selectedReport.assignedTeam.name, 'Team Charlie')}</span>
                                                </dd>
                                            </div>

                                            {(selectedReport.assignedTeam.etaMinutes != null || selectedReport.assignedTeam.distance != null || selectedReport.assignedTeam.estimatedArrivalTime != null) && (
                                                <div className="px-3 py-2 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-4">
                                                    <dt className="text-[10px] sm:text-xs font-medium leading-5 text-gray-500 uppercase tracking-wider flex items-center gap-1">
                                                        <SolidClockIcon className="h-3.5 w-3.5 text-gray-400" /> ETA
                                                    </dt>
                                                    <dd className="mt-1 leading-5 text-gray-800 sm:col-span-2 sm:mt-0">
                                                        {selectedReport.assignedTeam.etaMinutes != null ? (
                                                            selectedReport.assignedTeam.etaMinutes > 10000 ? // Handle large value
                                                                <span title={`Raw value: ${selectedReport.assignedTeam.etaMinutes}`}>Calculating...</span>
                                                                : `${selectedReport.assignedTeam.etaMinutes} min ETA`
                                                        ) : selectedReport.assignedTeam.estimatedArrivalTime ? (
                                                            `Est. Arrival: ${new Date(selectedReport.assignedTeam.estimatedArrivalTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                                        ) : ('ETA N/A')}
                                                        {selectedReport.assignedTeam.distance != null && (
                                                            <span className="ml-2 text-[10px] text-gray-500">
                                                                (~{(selectedReport.assignedTeam.distance / 1000).toFixed(1)} km)
                                                            </span>
                                                        )}
                                                    </dd>
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {selectedReport.recordingLink && (
                                        <>
                                            <div className="px-3 py-2 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-4">
                                                <dt className="text-[10px] sm:text-xs font-medium leading-5 text-gray-500 uppercase tracking-wider flex items-center gap-1">
                                                    <SpeakerWaveIcon className="h-3.5 w-3.5 text-gray-400" /> Recording
                                                </dt>
                                                <dd className="mt-1 leading-5 text-gray-800 sm:col-span-2 sm:mt-0 flex items-center gap-2">
                                                    <button
                                                        onClick={() => audioRef.current?.play()}
                                                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline font-medium"
                                                    >
                                                        <PlayCircleIcon className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
                                                        <span className="text-[11px] sm:text-sm">Play</span>
                                                    </button>
                                                    <audio ref={audioRef} src={selectedReport.recordingLink} />
                                                </dd>
                                            </div>

                                            {selectedReport.transcription && (
                                                <div className="px-3 py-2 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-4">
                                                    <dt className="text-[10px] sm:text-xs font-medium leading-5 text-gray-500 uppercase tracking-wider flex items-center gap-1">
                                                        Transcript
                                                    </dt>
                                                    <dd className="mt-1 leading-5 text-gray-800 sm:col-span-2 sm:mt-0 text-[11px] sm:text-sm">
                                                        {selectedReport.transcription}
                                                    </dd>
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {/* Incident Details */}
                                    <div className="px-3 py-2 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-4">
                                        <dt className="text-[10px] sm:text-xs font-medium leading-5 text-gray-500 uppercase tracking-wider flex items-center gap-1">
                                            <ClockIcon className="h-3.5 w-3.5 text-gray-400" /> Time
                                        </dt>
                                        <dd className="mt-1 leading-5 text-gray-800 sm:col-span-2 sm:mt-0">
                                            {selectedReport.timestamp ? new Date(selectedReport.timestamp).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : 'N/A'}
                                        </dd>
                                    </div>

                                    <div className="px-3 py-2 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-4">
                                        <dt className="text-[10px] sm:text-xs font-medium leading-5 text-gray-500 uppercase tracking-wider flex items-center gap-1">
                                            <OutlineMapPinIcon className="h-3.5 w-3.5 text-gray-400" /> Location
                                        </dt>
                                        <dd className="mt-1 leading-5 text-gray-800 sm:col-span-2 sm:mt-0">
                                            <span className="truncate block">{getSafe(() => selectedReport.location?.address) || `${getSafe(() => selectedReport.location?.lat?.toFixed(5), 'N/A')}, ${getSafe(() => selectedReport.location?.lng?.toFixed(5), 'N/A')}`}</span>
                                            {selectedReport.location?.lat && <a href={`https://www.google.com/maps?q=${selectedReport.location.lat},${selectedReport.location.lng}`} target="_blank" rel="noopener noreferrer" className="mt-0.5 inline-block text-[10px] text-indigo-600 hover:text-indigo-800 font-medium">(Open in Maps)</a>}
                                        </dd>
                                    </div>

                                    {selectedReport.description && (
                                        <div className="px-3 py-2 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-4">
                                            <dt className="text-[10px] sm:text-xs font-medium leading-5 text-gray-500 uppercase tracking-wider">Details</dt>
                                            <dd className={`mt-1 leading-5 sm:col-span-2 sm:mt-0 whitespace-pre-wrap text-[11px] sm:text-sm text-gray-800`}>
                                                {cleanIncidentText(selectedReport.description)}
                                            </dd>
                                        </div>
                                    )}
                                </dl>
                            </div>

                            {/* Panel Footer with enhanced styling */}
                            <div className="border-t border-gray-200 px-3 py-2 sm:px-4 bg-gradient-to-b from-gray-50/50 to-white flex-shrink-0">
                                <p className={`text-xs sm:text-sm font-medium text-center ${selectedReport.status === 'Resolved' ? 'text-green-700' :
                                    selectedReport.status === 'Declined' ? 'text-orange-700' :
                                        selectedReport.status === 'Responding' || selectedReport.status === 'assigned' ? 'text-blue-700' :
                                            'text-gray-600' // Default color
                                    }`}>
                                    {getStatusLabel(selectedReport.status)}
                                    {selectedReport.assignedTeam && (selectedReport.status === 'Responding' || selectedReport.status === 'assigned') && ` (Unit: ${getSafe(() => selectedReport.assignedTeam.name, '?')})`}
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {/* Sidebar - Enhanced responsive design */}
            <aside className={`${showSidebarMobile ? 'fixed inset-0 z-40' : 'hidden'} md:relative md:block w-full md:w-[350px] lg:w-[380px] flex-shrink-0 border-l border-gray-200 bg-white flex flex-col h-full md:z-auto`}>
                {/* Semi-transparent overlay with blur effect */}
                <div
                    className={`absolute inset-0 bg-black/30 backdrop-blur-sm md:hidden ${showSidebarMobile ? 'block' : 'hidden'}`}
                    onClick={() => setShowSidebarMobile(false)}
                ></div>

                {/* Actual sidebar content */}
                <div className="relative h-full flex flex-col w-[85%] max-w-[350px] md:w-full md:max-w-none ml-auto shadow-2xl md:shadow-none bg-white">
                    {/* Mobile close button at top */}
                    <div className="md:hidden absolute top-3 left-3 z-50">
                        <button
                            onClick={() => setShowSidebarMobile(false)}
                            className="p-1.5 rounded-full bg-white/80 backdrop-blur-sm text-gray-600 hover:text-gray-900 shadow-md"
                        >
                            <XMarkIcon className="h-4 w-4" />
                        </button>
                    </div>

                    {/* Sidebar Header with enhanced styling */}
                    <div className="px-3 py-3 bg-gradient-to-r from-gray-100 to-white border-b border-gray-200 flex-shrink-0">
                        <div className="relative">
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5">
                                <MagnifyingGlassIcon className="h-4 w-4 text-gray-400" />
                            </div>
                            <input
                                type="search" name="search" id="search"
                                placeholder="Search by ID, type, status..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="block w-full rounded-md border-0 py-1.5 pl-8 pr-3 text-sm text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-600 leading-5 shadow-sm"
                            />
                        </div>
                    </div>

                    {/* Stats Area with enhanced styling */}
                    <div className="bg-gradient-to-r from-gray-50 to-white px-3 py-2 border-b border-gray-200 flex-shrink-0 shadow-sm">
                        <dl className="grid grid-cols-2 gap-x-4 divide-x divide-gray-300">
                            <div className="py-1.5">
                                <dt className="truncate text-[10px] font-medium text-gray-500 uppercase tracking-wider">Active High Sev.</dt>
                                <dd className="mt-0.5 text-xl sm:text-2xl font-semibold tracking-tight text-amber-600 flex items-center gap-1">
                                    {highSeverityCount}
                                    {isFetchingIncidents && <ArrowPathIcon className="h-3.5 w-3.5 text-gray-400 animate-spin" />}
                                </dd>
                            </div>
                            <div className="py-1.5 pl-4">
                                <dt className="truncate text-[10px] font-medium text-gray-500 uppercase tracking-wider">Total Reports</dt>
                                <dd className="mt-0.5 text-xl sm:text-2xl font-semibold tracking-tight text-indigo-600 flex items-center gap-1">
                                    {totalReportsCount}
                                    {isFetchingIncidents && <ArrowPathIcon className="h-3.5 w-3.5 text-gray-400 animate-spin" />}
                                </dd>
                            </div>
                        </dl>
                    </div>

                    {/* Report List Area with enhanced styling */}
                    <div className="flex-1 overflow-y-auto select-none overscroll-contain">
                        {/* Loading State */}
                        {isLoading && !filteredReports.length && (
                            <div className="p-6 flex justify-center items-center h-full">
                                <div className="text-center">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto mb-3"></div>
                                    <p className="text-xs text-gray-500">Loading reports...</p>
                                </div>
                            </div>
                        )}

                        {/* Error State with enhanced styling */}
                        {isErrorIncidents && !isLoading && (
                            <div className="p-3 m-3 text-center text-red-700 bg-red-50 border border-red-200 rounded-lg shadow-sm">
                                <div className="flex items-center justify-center gap-1.5">
                                    <ExclamationTriangleIcon className="h-4 w-4" />
                                    <span className="text-xs">Error loading reports</span>
                                </div>
                                <button onClick={() => refetchIncidents()} className="mt-2 px-3 py-1 bg-white text-indigo-600 hover:text-indigo-800 border border-indigo-200 rounded-md text-xs font-medium shadow-sm hover:shadow transition-all">Retry</button>
                            </div>
                        )}

                        {/* Empty State with enhanced styling */}
                        {!isLoading && !isErrorIncidents && filteredReports.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full px-5 py-8 text-center">
                                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                                    <InboxIcon className="h-6 w-6 text-gray-400" />
                                </div>
                                <h3 className="text-sm font-semibold text-gray-900">No Reports Found</h3>
                                <p className="mt-1 text-xs text-gray-500 max-w-xs">{searchTerm ? 'Try adjusting your search terms.' : 'No active reports at this time.'}</p>
                            </div>
                        )}

                        {/* Report List with enhanced styling */}
                        {!isLoading && !isErrorIncidents && filteredReports.length > 0 && (
                            <ul role="list" className="divide-y divide-gray-100">
                                {filteredReports.map((report) => {
                                    if (!report || !report.id) {
                                        console.warn("Skipping rendering of invalid report item:", report);
                                        return null;
                                    }
                                    const statusStyle = getStatusStyle(report.status);
                                    const isSelected = selectedReport?.id === report.id;
                                    return (
                                        <li
                                            key={report.id}
                                            id={`report-item-${report.id}`}
                                            onClick={() => handleReportSelect(report)}
                                            className={`relative flex items-center justify-between gap-x-2 px-3 py-2.5 cursor-pointer outline-none group transition-all duration-150 active-touch ${isSelected ? 'bg-indigo-50/80' : 'hover:bg-gray-50'}`}
                                            tabIndex={0}
                                            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleReportSelect(report)} // Allow selection with keyboard
                                            aria-current={isSelected ? 'page' : undefined}
                                        >
                                            {/* Selected item indicator with animation */}
                                            {isSelected && (<div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600 animate" aria-hidden="true"></div>)}

                                            {/* List item content */}
                                            <div className="flex items-center gap-x-2 flex-shrink-0 min-w-0">
                                                <div className="relative flex-shrink-0" title={`${report.severity || 'Unknown'} Severity`}>
                                                    <div className={`h-2 w-2 rounded-full ${getSeverityDotClasses(report.severity)}`} />
                                                    {/* Ping animation for new high severity reports */}
                                                    {(report.severity === 'High' && report.status === 'New') && (<div className={`absolute inset-0 h-2 w-2 rounded-full ${getSeverityDotClasses(report.severity)} animate-ping opacity-75`} />)}
                                                </div>
                                                <span className="text-xl leading-none flex-shrink-0 group-hover:scale-110 transition-transform">{getSafe(() => report.crime.emoji, '❓')}</span>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-xs font-medium leading-snug ${isSelected ? 'text-indigo-700' : 'text-gray-900 group-hover:text-indigo-600'} truncate`}>{getSafe(() => report.crime.label, 'Incident')}</p>
                                                    <div className="mt-0.5 flex items-center gap-x-1.5 text-[10px] leading-tight text-gray-500">
                                                        {/* Display formatted status and time ago */}
                                                        <span className={`font-medium ${statusStyle?.textColor || 'text-gray-700'}`}>{getStatusLabel(report.status) || 'Unknown'}</span>
                                                        <span className='text-gray-300'>·</span>
                                                        <ClockIcon className="h-2.5 w-2.5 flex-shrink-0 text-gray-400" />
                                                        <time dateTime={report.timestamp}>{formatTimeAgo(report.timestamp)}</time>
                                                    </div>
                                                </div>
                                            </div>
                                            {/* Short report ID with styling */}
                                            <div className="flex-shrink-0 ml-1">
                                                <span className="text-[9px] text-gray-400 px-1.5 py-0.5 rounded-full bg-gray-50 group-hover:bg-gray-100">#{String(report.id).substring(0, 6)}</span>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                </div>
            </aside>
        </div>
    );
}

export default AuthorityDashboard;