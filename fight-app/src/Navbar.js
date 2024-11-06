import React from 'react';
import { Link } from 'react-router-dom';

function Navbar() {
    return (
        <div className="Navbar">
            <Link to="/">Home</Link>
            <Link to="/UFC">UFC</Link>
            <Link to="/Events">Events</Link>
            <Link to="/Football">Football</Link>
        </div>
    );
}

export default Navbar;
// No additional code needed here for the Docker container setup.
