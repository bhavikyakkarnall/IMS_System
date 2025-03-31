import React, { useEffect, useState } from 'react';
import axios from 'axios';

function Home({ setLoggedIn }) {
  const [message, setMessage] = useState('Loading...');

  useEffect(() => {
    axios.get('/api/home')
      .then(res => {
        if (res.data.success) setMessage(res.data.message);
      })
      .catch(err => setMessage('You are not logged in.'));
  }, []);

  return (
    <div className="card p-3">
      <h2>Home</h2>
      <p>{message}</p>
    </div>
  );
}

export default Home;
