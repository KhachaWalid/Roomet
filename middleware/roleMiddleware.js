// Middleware to enforce role-based access control
module.exports = function(requiredRole) {
    return (req, res, next) => {
        if (!req.session.user) {
            return res.status(401).json({ message: "Unauthorized - Please login" });
        }

        const userRole = req.session.user.role;
        if (!userRole || userRole !== requiredRole) {
            return res.status(403).json({ message: "Forbidden - You do not have the required role" });
        }

        next(); // User has the required role, proceed
    };
};