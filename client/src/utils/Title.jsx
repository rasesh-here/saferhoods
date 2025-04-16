import { useEffect } from 'react';
const Title = ({ title }) => {
    useEffect(() => {
        // Save the previous title to restore it when component unmounts
        const prevTitle = document.title;

        // Update title with the provided title and append app name
        document.title = `${title} | SaferHoods`;

        // Cleanup function to restore previous title on unmount
        return () => {
            document.title = prevTitle;
        };
    }, [title]);

    return null;
};

export default Title; 