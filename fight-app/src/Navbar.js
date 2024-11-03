import React, { useState } from 'react';
import { Link } from 'react-router-dom';

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
            </div>
            <Link to="/Events">Events</Link>
            <Link to="/Football">Football</Link>
        </div>
    );
}

export default Navbar;
// No additional code needed here for the Docker container setup.
