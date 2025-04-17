// Allow any authenticated user (student/admin/director)
module.exports = function() {
    return (req, res, next) => {
      if (!req.session.user) {
        return res.status(401).json({ message: "Unauthorized - Please login" });
      }
      next(); // All logged-in users can proceed
    };
  };