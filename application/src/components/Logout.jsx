import React, { useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function Logout({ setLoggedIn }) {
  const navigate = useNavigate();
  useEffect(() => {
    axios.post('/api/logout')
      .then(() => {
        setLoggedIn(false);
        navigate('/login');
      })
      .catch(err => console.error("Error logging out", err));
  }, [navigate, setLoggedIn]);

  return <div>Logging out...</div>;
}

export default Logout;
