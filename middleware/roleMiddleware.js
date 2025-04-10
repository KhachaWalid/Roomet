// Updated to handle specific permissions
module.exports = function(requiredRole, requiredPermission = null) {
    return (req, res, next) => {
        if (!req.session.user) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        // Director has full access
        if (req.session.user.role === "director") return next();

        // Admin only has maintenance access
        if (requiredRole === "admin" && req.session.user.role === "admin") {
            return next();
        }

        return res.status(403).json({ message: "Insufficient permissions" });
    };
};