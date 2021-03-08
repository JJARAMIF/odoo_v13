from odoo import api, SUPERUSER_ID
from odoo.addons.http_routing.models.ir_http import slugify


def migrate(cr, installed_version):
    env = api.Environment(cr, SUPERUSER_ID, {})

    # Migrate timesheet activity
    Activity = env['request.timesheet.activity'].with_context(
        active_test=False)
    for record in Activity.search([('code', '=', False)]):
        code = slugify(record.display_name, max_length=0)
        if Activity.search_count([('code', '=', code)]) > 0:
            code = "%s-%s" % (code, record.id)
        record.code = code
