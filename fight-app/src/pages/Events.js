import React, {useEffect, useState} from 'react';
import './Events.css';

function Events() {
    const [navigationData, setNavigationData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchNavigation = async () => {
            try {
                const response = await fetch(
                    'https://secure.espn.com/core/api/v0/nav/index?&device=desktop&country=us&lang=en&region=us&site=espn&edition-host=espn.com&site-type=full'
                );
                
                if (!response.ok) {
                    throw new Error('Failed to fetch data');
                }
                const data = await response.json();
                setNavigationData(data.navigation);
            } catch (error) {
                setError(error.message);
            } finally {
                setLoading(false);
            }
        };

        fetchNavigation();
    }, []);

    if (loading) return <div>Loading...</div>;
    if (error) return <div>Error: {error}</div>;
    if (!navigationData) return <div>No data available</div>;

    const renderNavItem = (item) => (
        <div key={item.id} className="event-card">
            <h3>{item.text || item.title}</h3>
            {item.links && Array.isArray(item.links) && item.links.map((link, index) => (
                <div key={index} className="team-odds">
                    <span className="team-name">{link.text}</span>
                    <a href={`https://www.espn.com${link.href}`} className="odds" target="_blank" rel="noopener noreferrer">
                        {link.shortText || 'View'}
                    </a>
                </div>
            ))}
            {item.items && Array.isArray(item.items) && (
                <div className="sub-items">
                    {item.items.map(renderNavItem)}
                </div>
            )}
        </div>
    );

    const findNFLData = (items) => {
        for (let item of items) {
            if (item.text === "NFL") {
                return item;
            }
            if (item.items && Array.isArray(item.items)) {
                const result = findNFLData(item.items);
                if (result) return result;
            }
        }
        return null;
    };

    const nflData = navigationData.items ? findNFLData(navigationData.items) : null;

    return (
        <div className="events-container">
            <h1 className="events-header">NFL Schedule</h1>
            {nflData && renderNavItem(nflData)}
        </div>
    );
}

export default Events;
