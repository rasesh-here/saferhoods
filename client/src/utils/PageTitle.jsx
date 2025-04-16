import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const PageTitle = () => {
  const location = useLocation();

  useEffect(() => {
    // Define route-to-title mapping
    const getTitleByRoute = (pathname) => {
      const routes = {
        '/': 'Home | SaferHoods',
        '/authority': 'Authority Dashboard | SaferHoods',
        '/responder': 'Response Team | SaferHoods',
        '/socket-test': 'Socket Demo | SaferHoods',
        '/socket-test/reporter': 'Reporter Chat | SaferHoods',
        '/socket-test/authority': 'Authority Chat | SaferHoods',
      };

      // Return the mapped title or a default if the route isn't found
      return routes[pathname] || '404 Not Found | SaferHoods';
    };

    // Update the document title
    document.title = getTitleByRoute(location.pathname);
  }, [location]);

  // This component doesn't render anything
  return null;
};

export default PageTitle; 