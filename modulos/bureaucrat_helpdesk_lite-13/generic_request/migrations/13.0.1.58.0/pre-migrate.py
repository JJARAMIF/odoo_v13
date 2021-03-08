def migrate(cr, installed_version):
    cr.execute("""
        UPDATE ir_model_data
        SET module = 'generic_request'
        WHERE module = 'generic_request_timesheet'
          AND model IN (
                 'ir.model.fields',
                 'ir.model.constraint',
                 'ir.model.relation',
                 'ir.ui.menu',
                 'ir.model.access',
                 'ir.actions.act_window',
                 'ir.rule',
                 'request.timesheet.activity',
                 'request.timesheet.line');

        UPDATE ir_model_relation
        SET module=(
            SELECT id FROM ir_module_module
            WHERE name='generic_request')
        WHERE module=(
            SELECT id FROM ir_module_module
            WHERE name='generic_request_timesheet');

        -- Delete views that inherits thats are defined in request_kind
        DELETE FROM ir_ui_view WHERE inherit_id IN (
            SELECT res_id
            FROM ir_model_data
            WHERE model = 'ir.ui.view'
              AND module = 'generic_request_timesheet'
        );

        -- Delete views
        DELETE FROM ir_ui_view WHERE id IN (
            SELECT res_id
            FROM ir_model_data
            WHERE model = 'ir.ui.view'
              AND module = 'generic_request_timesheet'
        );

        -- Delete constraints
        DELETE FROM ir_model_constraint WHERE module = (
            SELECT id
            FROM ir_module_module
            WHERE name = 'generic_request_timesheet'
        );

        -- DELETE references to ir_model
        DELETE FROM ir_model_data
        WHERE model = 'ir.model'
          AND module = 'generic_request_timesheet';

        -- DELETE removed modules from database
        DELETE FROM ir_module_module WHERE name = 'generic_request_timesheet';
    """)
