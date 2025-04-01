import React, { useState, useEffect } from 'react';
import axios from 'axios';

function Comments({ itemId, userRole }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchComments();
  }, [itemId]);

  const fetchComments = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/inventory/${itemId}/comments`, { withCredentials: true });
      if (res.data.success) {
        setComments(res.data.comments);
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
    setLoading(false);
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      const res = await axios.post(
        `/api/inventory/${itemId}/comments`,
        { comment: newComment },
        { withCredentials: true }
      );

      if (res.data.success) {
        setNewComment('');
        fetchComments(); // Refresh comments
      }
    } catch (error) {
      console.error('Error submitting comment:', error);
    }
  };

  // Helper to format timestamp
  const formatDateTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString(); // e.g., "4/1/2025, 2:30:00 PM"
  };

  return (
    <div>
      <h6>Comments</h6>
      {loading ? (
        <p>Loading comments...</p>
      ) : comments.length === 0 ? (
        <p>No comments yet.</p>
      ) : (
        <ul className="list-group mb-3">
          {comments.map((c, idx) => (
            <li key={idx} className="list-group-item">
              <strong>{c.user}:</strong> {c.text}
              <br />
              <small className="text-muted">{formatDateTime(c.created_at)}</small>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleCommentSubmit}>
        <div className="input-group">
          <input
            type="text"
            className="form-control"
            placeholder="Write a comment..."
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
          />
          <button className="btn btn-primary" type="submit">Post</button>
        </div>
        <small className="form-text text-muted">
          {userRole === 'admin'
            ? 'Admin-only comment (visible to admins only)'
            : 'Comment visible to you and admins'}
        </small>
      </form>
    </div>
  );
}

export default Comments;
