import { BrowserRouter as Router, Route, Routes, NavLink } from 'react-router-dom';
import UserApp from './components/UserApp';
import AuthorityDashboard from './components/AuthorityDashboard';
import ResponseTeamView from './components/ResponseTeamView';
// import { FaUser, FaBuilding, FaShieldAlt, FaBars } from 'react-icons/fa';
// import { BsQuestionCircle, BsChatSquareText } from 'react-icons/bs';
import { Toaster} from 'sonner'
import {
    UserIcon,
    BuildingOfficeIcon,
    Bars3Icon,
    QuestionMarkCircleIcon,
    ExclamationTriangleIcon,
    EyeSlashIcon,
    XMarkIcon
} from '@heroicons/react/24/outline';
import SocketTestPage from './pages/socketTest/SocketTestPage';
import ReporterView from './pages/socketTest/ReporterView';
import AuthorityView from './pages/socketTest/AuthorityView';
import { SocketProvider } from './pages/socketTest/SocketContext';
import PageTitle from './utils/PageTitle';
import { detectBrave } from './utils/helper';
import { useEffect, useState, useRef } from 'react';

const Navigation = () => {
    // Define base classes common to all nav links for consistency
    const baseNavClasses = "inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 ease-in-out";

    // Define classes specifically for the active state
    const activeNavClasses = "bg-indigo-100 text-indigo-700";

    // Define classes specifically for the inactive state (including hover)
    const inactiveNavClasses = "text-stone-600 hover:bg-stone-100 hover:text-stone-800";

    // State to control mobile menu visibility
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const menuRef = useRef(null);

    // Handle clicks outside the menu to close it
    useEffect(() => {
        function handleClickOutside(event) {
            if (mobileMenuOpen && menuRef.current && !menuRef.current.contains(event.target)) {
                setMobileMenuOpen(false);
            }
        }

        // Add event listener when the mobile menu is open
        if (mobileMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('touchstart', handleClickOutside);
        }

        // Clean up event listener
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [mobileMenuOpen]);

    // Common navigation links for both desktop and mobile
    const navLinks = [
        { to: "/", icon: UserIcon, text: "User" },
        { to: "/authority", icon: BuildingOfficeIcon, text: "Authority" },
        // { to: "/responder", icon: ShieldCheckIcon, text: "Responder" },
        { to: "/socket-test", icon: EyeSlashIcon, text: "Go Anonymous" }
    ];

    return (
        <nav className="fixed top-0 left-0 right-0 z-[1000] h-14 bg-white border-b border-stone-200 shadow-sm">
            <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 h-full">
                <div className="flex justify-between items-center h-full">
                    {/* Logo */}
                    <div className="flex-shrink-0 flex items-center">
                        {/* Simple Logo */}
                        <svg className="h-7 w-auto text-indigo-600" fill="currentColor" viewBox="0 0 24 24"> <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" /> </svg>
                        <span className="ml-2 text-lg font-semibold text-stone-800">SaferHoods</span>
                    </div>

                    {/* Desktop Navigation Links */}
                    <div className="hidden sm:ml-6 sm:flex sm:space-x-3">
                        {navLinks.map((link) => (
                            <NavLink
                                key={link.to}
                                to={link.to}
                                className={({ isActive }) =>
                                    `${baseNavClasses} ${isActive ? activeNavClasses : inactiveNavClasses}`
                                }
                            >
                                <link.icon className="-ml-0.5 mr-1.5 h-5 w-5" aria-hidden="true" />
                                {link.text}
                            </NavLink>
                        ))}
                    </div>

                    {/* Mobile Menu Button */}
                    <div className="-mr-2 flex items-center sm:hidden">
                        <button
                            type="button"
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className="relative inline-flex items-center justify-center rounded-md bg-white p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                        >
                            <span className="absolute -inset-0.5" />
                            <span className="sr-only">Open main menu</span>
                            {mobileMenuOpen ? (
                                <XMarkIcon className="block h-5 w-5" aria-hidden="true" />
                            ) : (
                                <Bars3Icon className="block h-5 w-5" aria-hidden="true" />
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Navigation Menu */}
            <div ref={menuRef} className={`sm:hidden ${mobileMenuOpen ? 'block' : 'hidden'}`}>
                <div className="absolute inset-x-0 top-14 bg-white border-b border-stone-200 shadow-md rounded-b-lg z-20 overflow-hidden">
                    <div className="px-2 pt-2 pb-3 space-y-1">
                        {navLinks.map((link) => (
                            <NavLink
                                key={link.to}
                                to={link.to}
                                className={({ isActive }) =>
                                    `${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-stone-600 hover:bg-stone-50'} flex items-center px-3 py-3 rounded-md text-base font-medium`
                                }
                                onClick={() => setMobileMenuOpen(false)}
                            >
                                <link.icon className="mr-3 h-6 w-6 flex-shrink-0" aria-hidden="true" />
                                {link.text}
                            </NavLink>
                        ))}
                    </div>
                </div>
            </div>
        </nav>
    );
};

function App() {
    const [isBrave, setIsBrave] = useState(false);

    useEffect(() => {
        const checkBrave = async () => {
            const result = await detectBrave();
            setIsBrave(result);
        };
        checkBrave();
    }, []);

    return (
        <Router>
                <Toaster richColors closeButton  position="top-center" />
                <PageTitle />
                <div className="h-screen w-screen flex flex-col overflow-hidden">
                    {isBrave && (
                        <div className="absolute top-0 left-0 right-0 bg-amber-100 z-[1001] p-2 text-xs text-center">
                            <div className="flex items-center justify-center space-x-1">
                                <ExclamationTriangleIcon className="h-4 w-4 text-amber-600" />
                                <span className="text-amber-800">
                                    Brave browser detected! Location accuracy may be affected.
                                </span>
                            </div>
                        </div>
                    )}

                    <Navigation />

                    {/* Main content area with flex-1 to fill remaining space */}
                    <main className="flex-1 pt-14 bg-stone-100 overflow-hidden">
                        <Routes>
                            <Route path="/" element={<UserApp />} />
                            <Route path="/authority" element={<AuthorityDashboard />} />
                            <Route path="/responder" element={<ResponseTeamView />} />

                            <Route path="/socket-test" element={
                                <SocketProvider>
                                    <SocketTestPage />
                                </SocketProvider>
                            } />
                            <Route path="/socket-test/reporter" element={
                                <SocketProvider>
                                    <ReporterView />
                                </SocketProvider>
                            } />
                            <Route path="/socket-test/authority" element={
                                <SocketProvider>
                                    <AuthorityView />
                                </SocketProvider>
                            } />

                            <Route path="*" element={
                                <div className="flex flex-col items-center justify-center h-full text-stone-500">
                                    <QuestionMarkCircleIcon className="h-16 w-16 text-stone-300 mb-4" />
                                    <h1 className="text-2xl font-semibold mb-2">404 - Page Not Found</h1>
                                    <p>The page you are looking for does not exist.</p>
                                    <NavLink to="/" className="mt-4 text-indigo-600 hover:text-indigo-800 font-medium">
                                        Go back home
                                    </NavLink>
                                </div>
                            } />
                        </Routes>
                    </main>
                </div>
        </Router>
    );
}

export default App;