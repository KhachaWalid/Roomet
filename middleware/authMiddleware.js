module.exports = (requiredRole) => (req, res, next) => {
    if (!req.session.user) {
        return res.status(401).json({ message: "Unauthorized - No session" });
    }

    if (req.session.user.role !== requiredRole) {
        return res.status(403).json({ message: "Forbidden - Insufficient permissions" });
    }

    next();
};
