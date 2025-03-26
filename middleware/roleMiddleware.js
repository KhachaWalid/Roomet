module.exports = function(requiredRole, requiredAdminType = null) {
    return (req, res, next) => {
        if (!req.session.user || req.session.user.role !== requiredRole) {
            return res.status(403).json({ message: "Forbidden - Insufficient permissions" });
        }

        if (requiredRole === "admin" && requiredAdminType && req.session.user.adminType !== requiredAdminType) {
            return res.status(403).json({ message: "Forbidden - You are not authorized for this action" });
        }

        next();
    };
};
