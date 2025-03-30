import React, { useState, useEffect } from 'react';
import axios from 'axios';

function Comments({ itemId, userRole }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');

  const fetchComments = () => {
    axios.get(`/api/inventory/${itemId}/comments`)
      .then(res => setComments(res.data.comments || []))
      .catch(err => console.error(err));
  };

  useEffect(() => {
    fetchComments();
  }, [itemId, userRole]);

  const addComment = () => {
    if (!newComment.trim()) return;
    axios.post(`/api/inventory/${itemId}/comments`, { comment: newComment })
      .then(res => {
        setNewComment('');
        setComments(res.data.comments);
      })
      .catch(err => console.error(err));
  };

  return (
    <div className="border-top pt-2">
      {comments.length === 0
        ? <p>No comments.</p>
        : comments.map(comment => (
            <p key={comment.id}><em>{comment.user}:</em> {comment.text}</p>
          ))
      }
      <div className="mt-2">
        <textarea 
          className="form-control" 
          placeholder="Add a comment" 
          value={newComment}
          onChange={e => setNewComment(e.target.value)}
        />
        <button className="btn btn-primary btn-sm mt-2" onClick={addComment}>Add Comment</button>
      </div>
    </div>
  );
}

export default Comments;
