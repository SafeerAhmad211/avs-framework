"""AVS Framework - Audit, Validation, Security for AI employment decision systems.

Open-source statistical engine for the Audit and Security pillars of the AVS
Framework: adverse impact analysis under the Uniform Guidelines, name-swap bias
testing, and model drift detection.

MIT License | Nauta Research Labs | nautaresearchlabs.com
"""

from .audit import AuditFinding, AVSAdverseImpactAudit
from .drift import AVSDriftDetector
from .security import AVSNameSwapTest

__version__ = "0.1.0"

__all__ = [
    "AVSAdverseImpactAudit",
    "AuditFinding",
    "AVSDriftDetector",
    "AVSNameSwapTest",
    "__version__",
]
