import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import weightClasses from './pages/WeightClass'; // Import the WeightClass data

function Navbar() {
    const [showDropdown, setShowDropdown] = useState(false);

    return (
        <div className="Navbar">
            <Link to="/">Home</Link>
            <div 
                onMouseEnter={() => setShowDropdown(true)}
                onMouseLeave={() => setShowDropdown(false)}
            >
                <Link to="/UFC">UFC</Link>
                {showDropdown && (
                    <div className="dropdown">
                        <Link to="/WeightClass">Weight Classes</Link>
                    </div>
                )}
            </div>
            <Link to="/Events">Events</Link>
            <Link to="/Football">Football</Link>
        </div>
    );
}

export default Navbar;
// No additional code needed here for the Docker container setup.
