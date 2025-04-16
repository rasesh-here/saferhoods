import React, { useState, useEffect, Fragment } from 'react';
import { useSelector } from 'react-redux';
import { useGeolocated } from 'react-geolocated';
import { Dialog, DialogPanel, DialogTitle, Popover, Transition, TransitionChild } from '@headlessui/react';
import { XMarkIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';
import { selectResponderState } from '../store/responderSlice';
import UnifiedMap from './UnifiedMap';
import { useAddIncidentMutation, useGetIncidentsQuery } from '../api/reportApi';
import { Title } from '../utils';
import { toast } from 'sonner';

function useMediaQuery(query) {
    const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
    useEffect(() => {
        const mediaQuery = window.matchMedia(query);
        const handler = () => setMatches(mediaQuery.matches);
        mediaQuery.addEventListener('change', handler);
        return () => mediaQuery.removeEventListener('change', handler);
    }, [query]);
    return matches;
}


const DEFAULT_LOCATION = { lat: 21.21728, lng: 72.7810048 };
const DEFAULT_ZOOM = 14;

function UserApp() {
    const responderState = useSelector(selectResponderState);
    const [isReportDrawerOpen, setIsReportDrawerOpen] = useState(false);
    const [reportStep, setReportStep] = useState(1);
    const [selectedCrime, setSelectedCrime] = useState(null);
    const [description, setDescription] = useState('');
    const [selectedSeverity, setSelectedSeverity] = useState('Medium');
    const [userLocation, setUserLocation] = useState(null);
    const [mapCenter, setMapCenter] = useState(DEFAULT_LOCATION);
    const [mapZoom, setMapZoom] = useState(DEFAULT_ZOOM);
    const [isLocating, setIsLocating] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);


    const [addIncident] = useAddIncidentMutation();
    const { data: incidentsData = [] } = useGetIncidentsQuery();

    const isDesktop = useMediaQuery('(min-width: 768px)');

    const { coords, isGeolocationAvailable, isGeolocationEnabled } = useGeolocated({
        positionOptions: { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
        watchPosition: false,
        userDecisionTimeout: 5000,
    });

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
        setIsLocating(false);

    }, [coords, isGeolocationAvailable, isGeolocationEnabled]);

    const openReportDrawer = () => {
        if (!userLocation && !isLocating) {
            toast.warning("Could not determine your location. Please enable location services to report an incident.");
            return;
        }

        setSelectedCrime(null);
        setSelectedSeverity('Medium');
        setDescription('');
        setReportStep(1);
        setIsReportDrawerOpen(true);
    };

    const closeReportDrawer = () => setIsReportDrawerOpen(false);

    const handleCrimeSelect = (crime) => {
        setSelectedCrime(crime);
        setSelectedSeverity('Medium');
        setReportStep(2);
    };

    const handleSubmitReport = async () => {
        if (!selectedCrime || !userLocation || !selectedSeverity) {
            toast.error("Error: Missing crime type, location, or severity.");
            return;
        }

        setIsSubmitting(true);

        try {
            const reportData = {
                type: selectedCrime.label,
                title: selectedCrime.label,
                severity: selectedSeverity,
                description: description.trim(),
                location: {
                    latitude: userLocation.lat,
                    longitude: userLocation.lng,
                },
                reported_by: "user-app-client-id",
                reporter_email: "user-app-client@example.com",
                is_verified: false,
            };

            await addIncident(reportData).unwrap();
            toast.success(`Report for ${selectedCrime.label} submitted successfully!`, 3000);
            setTimeout(() => closeReportDrawer(), 300);
        } catch (error) {
            console.error("Failed to submit report:", error);
            toast.error("Failed to submit report. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const crimes = [
        { emoji: '🔥', label: 'Fire Incident' },
        { emoji: '💰', label: 'Theft/Robbery' },
        { emoji: '👊', label: 'Assault/Fight' },
        { emoji: '🔨', label: 'Vandalism/Damage' },
        { emoji: '🚗', label: 'Traffic Accident' },
        { emoji: '❓', label: 'Suspicious Activity' },
        { emoji: '🔊', label: 'Noise Complaint' },
        { emoji: '🆘', label: 'Other Emergency' },
    ];

    const getSeverityButtonStyle = (severityValue) => {
        const isSelected = selectedSeverity === severityValue;
        let baseStyle = 'flex-1 rounded-md border px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 transition-colors duration-150';
        let selectedStyle = '';
        let hoverStyle = 'hover:bg-gray-50';

        switch (severityValue) {
            case 'High':
                selectedStyle = isSelected ? 'bg-red-600 text-white border-red-600 shadow-sm' : 'bg-white text-red-700 border-red-300';
                hoverStyle = isSelected ? '' : 'hover:bg-red-50';
                break;
            case 'Medium':
                selectedStyle = isSelected ? 'bg-yellow-500 text-white border-yellow-500 shadow-sm' : 'bg-white text-yellow-700 border-yellow-300';
                hoverStyle = isSelected ? '' : 'hover:bg-yellow-50';
                break;
            case 'Low':
                selectedStyle = isSelected ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-blue-700 border-blue-300';
                hoverStyle = isSelected ? '' : 'hover:bg-blue-50';
                break;
            default:
                selectedStyle = 'bg-white text-gray-700 border-gray-300';
        }
        return `${baseStyle} ${selectedStyle} ${hoverStyle}`;
    };


    return (
        <div className="h-full flex flex-col bg-gray-50 relative overflow-hidden">
            <Title title="Report an Incident" />

            {/* Map takes up all available space */}
            <main className="flex-1 isolate relative">
                <UnifiedMap
                    center={mapCenter}
                    zoom={mapZoom}
                    incidents={incidentsData}
                    userLocation={userLocation}
                    responder={responderState}
                    selectedIncidentId={null}
                    className="absolute inset-0"
                />
            </main>

            {/* Report Button with enhanced styling */}
            <div className="absolute bottom-6 right-6 z-10">
                <button
                    onClick={openReportDrawer}
                    disabled={!userLocation}
                    className={`bg-indigo-600 p-3 sm:p-4 rounded-full shadow-lg elevation-2 transition-all duration-300 ${!userLocation
                        ? 'opacity-50 cursor-not-allowed bg-gray-400'
                        : 'hover:bg-indigo-700 hover:scale-105 hover:shadow-xl active:scale-95'
                        }`}
                    title={userLocation ? "Report an Incident" : "Enable location to report"}
                    aria-label="Report an incident"
                >
                    <PaperAirplaneIcon className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
                    <span className="sr-only">Report Incident</span>
                </button>
            </div>

            {/* Location finding indicator */}
            {isLocating && (
                <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-10 bg-white rounded-full py-1.5 px-4 shadow-lg elevation-1 flex items-center space-x-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                    <span className="text-xs sm:text-sm font-medium text-gray-700">Finding your location...</span>
                </div>
            )}

            {/* Reporting Drawer with enhanced styling */}
            <Transition show={isReportDrawerOpen} as={Fragment}>
                <Dialog as="div" className="relative z-50" onClose={closeReportDrawer}>
                    {/* Overlay with improved blur effect */}
                    <TransitionChild
                        as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100"
                        leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0"
                    >
                        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
                    </TransitionChild>

                    {/* Drawer Panel */}
                    <div className="fixed inset-0 overflow-hidden">
                        <div className="absolute inset-0 overflow-hidden">
                            <TransitionChild
                                as={Fragment}
                                enter="transform transition ease-in-out duration-300 sm:duration-500"
                                enterFrom={isDesktop ? 'translate-x-full' : 'translate-y-full'}
                                enterTo="translate-x-0 translate-y-0"
                                leave="transform transition ease-in-out duration-300 sm:duration-500"
                                leaveFrom="translate-x-0 translate-y-0"
                                leaveTo={isDesktop ? 'translate-x-full' : 'translate-y-full'}
                            >
                                <DialogPanel
                                    className={`pointer-events-auto bg-white shadow-xl ring-1 ring-black/5 flex flex-col overflow-hidden
                                    ${isDesktop
                                            ? 'fixed right-0 top-0 bottom-0 w-full max-w-md border-l border-gray-200' // Side Panel on Desktop
                                            : 'fixed bottom-0 left-0 right-0 max-h-[90vh] rounded-t-2xl' // Taller Bottom Sheet on Mobile
                                        }`}
                                >
                                    {/* Header with visual enhancement */}
                                    <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 border-b border-indigo-500 px-4 py-4 sm:px-6 flex items-center justify-between">
                                        <DialogTitle className="text-lg font-semibold leading-6 text-white drop-shadow-sm">
                                            Report New Incident
                                        </DialogTitle>
                                        <button
                                            type="button"
                                            onClick={closeReportDrawer}
                                            className="rounded-md p-1 text-white/80 hover:text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/50"
                                            aria-label="Close panel"
                                        >
                                            <XMarkIcon className="h-6 w-6" />
                                        </button>
                                    </div>

                                    {/* Mobile draggable indicator */}
                                    {!isDesktop && (
                                        <div className="pt-1 pb-2 flex justify-center">
                                            <div className="w-12 h-1.5 rounded-full bg-gray-300"></div>
                                        </div>
                                    )}

                                    {/* Content with enhanced styling */}
                                    <div className="flex-1 overflow-y-auto p-4 sm:p-6">

                                        {/* Step 1: Crime Selection */}
                                        {reportStep === 1 && (
                                            <div className="space-y-5">
                                                <p className="text-sm text-gray-600">Select the type of incident:</p>
                                                <div className="grid grid-cols-2 gap-3">
                                                    {crimes.map((crime) => (
                                                        <button
                                                            key={crime.label}
                                                            onClick={() => handleCrimeSelect(crime)}
                                                            className="border flex flex-col items-center justify-center w-full rounded-lg py-4 px-2 shadow-sm 
                                                            hover:shadow-md hover:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 
                                                            focus:ring-offset-1 transition-all gap-2 group text-center bg-white h-[15vh] sm:aspect-square
                                                            active-touch"
                                                        >
                                                            <span className="text-3xl transform group-hover:scale-110 transition-transform">{crime.emoji}</span>
                                                            <span className="text-xs font-medium text-gray-700 group-hover:text-indigo-600 mt-1 line-clamp-2">
                                                                {crime.label}
                                                            </span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Step 2: Details Entry */}
                                        {reportStep === 2 && selectedCrime && (
                                            <div className="space-y-5">
                                                {/* Selected crime header */}
                                                <div className="flex items-center gap-3 p-4 bg-indigo-50 rounded-lg border border-indigo-100">
                                                    <div className="text-3xl flex-shrink-0">{selectedCrime.emoji}</div>
                                                    <div>
                                                        <h3 className="font-semibold text-gray-900">{selectedCrime.label}</h3>
                                                        <p className="text-sm text-indigo-700">Provide details and severity below.</p>
                                                    </div>
                                                </div>

                                                {/* --- Severity Selection with enhanced styling --- */}
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        Severity Level
                                                    </label>
                                                    <div className="flex gap-x-2" role="group" aria-label="Incident Severity">
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedSeverity('Low')}
                                                            className={getSeverityButtonStyle('Low')}
                                                        >
                                                            Low
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedSeverity('Medium')}
                                                            className={getSeverityButtonStyle('Medium')}
                                                        >
                                                            Medium
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedSeverity('High')}
                                                            className={getSeverityButtonStyle('High')}
                                                        >
                                                            High
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Description Input */}
                                                <div>
                                                    <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                                                        Description <span className="text-gray-400">(Optional)</span>
                                                    </label>
                                                    <textarea
                                                        id="description"
                                                        value={description}
                                                        onChange={(e) => setDescription(e.target.value)}
                                                        rows={4}
                                                        className="block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm placeholder-gray-400"
                                                        placeholder="Add details like number of people involved, vehicle descriptions, specific location notes..."
                                                    />
                                                </div>

                                                {/* Location Info with enhanced styling */}
                                                {userLocation && (
                                                    <div className="text-xs bg-gray-50 p-3 rounded-md border border-gray-200">
                                                        <div className="flex items-center text-gray-700 font-medium mb-0.5">
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                            </svg>
                                                            Your Location
                                                        </div>
                                                        <p className="text-gray-500">
                                                            Lat: {userLocation.lat.toFixed(5)}, Lng: {userLocation.lng.toFixed(5)}
                                                            {userLocation.accuracy && (<span className="block mt-0.5">Accuracy: ~{userLocation.accuracy.toFixed(0)}m</span>)}
                                                        </p>
                                                    </div>
                                                )}

                                                {/* Action Buttons with enhanced styling */}
                                                <div className="pt-2 space-y-3">
                                                    <button
                                                        onClick={handleSubmitReport}
                                                        disabled={isSubmitting}
                                                        className={`w-full flex justify-center items-center gap-2 
                                                                ${isSubmitting
                                                                ? 'bg-indigo-400 cursor-wait'
                                                                : 'bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800'
                                                                } 
                                                            text-white py-3 px-4 rounded-md shadow-sm transition-all font-medium 
                                                            focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2`}
                                                    >
                                                        {isSubmitting ? (
                                                            <>
                                                                <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                                                                </svg>
                                                                Submitting...
                                                            </>
                                                        ) : (
                                                            <>
                                                                <PaperAirplaneIcon className="h-5 w-5 transform -rotate-45" />
                                                                Submit Report
                                                            </>
                                                        )}
                                                    </button>

                                                    <button
                                                        onClick={() => setReportStep(1)}
                                                        className="w-full bg-white text-gray-700 py-3 px-4 rounded-md border border-gray-300 hover:bg-gray-50 shadow-sm transition-colors font-medium focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1"
                                                    >
                                                        Back to Categories
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </DialogPanel>
                            </TransitionChild>
                        </div>
                    </div>
                </Dialog>
            </Transition>
        </div>
    );
}

export default UserApp;