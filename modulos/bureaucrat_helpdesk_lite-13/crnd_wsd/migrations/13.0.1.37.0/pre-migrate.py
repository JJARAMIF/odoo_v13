def migrate(cr, installed_version):
    cr.execute("""
        -- Delete views that inherits thats are defined in crnd_wsd_timesheet
        DELETE FROM ir_ui_view WHERE inherit_id IN (
            SELECT res_id
            FROM ir_model_data
            WHERE model = 'ir.ui.view'
              AND module = 'crnd_wsd_timesheet'
        );

        -- Delete views
        DELETE FROM ir_ui_view WHERE id IN (
            SELECT res_id
            FROM ir_model_data
            WHERE model = 'ir.ui.view'
              AND module = 'crnd_wsd_timesheet'
        );

        DELETE FROM ir_model_data
        WHERE module = 'crnd_wsd_timesheet';

        -- DELETE removed modules from database
        DELETE FROM ir_module_module WHERE name = 'crnd_wsd_timesheet';
    """)
